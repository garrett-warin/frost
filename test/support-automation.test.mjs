import {createSupportAutomation,appealInstruction} from '../platform/support-automation.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlatformService} from '../platform/http.mjs';
import {createStaff} from '../platform/staff.mjs';
import {memoryStore} from './helpers/platform-store.mjs';
import {hash,token} from '../platform/security.mjs';
import {atomic} from '../platform/store.mjs';
async function setup(clock=()=>1000){const store=memoryStore(),config={supportAI:true,origin:'https://accounts.example',internalSecret:'i'.repeat(64),endpoints:[],vaultKey:Buffer.alloc(32).toString('base64')},service=createPlatformService({store,config,now:clock});const sessions={};await atomic(store,async tx=>{await tx.put('staff-roster',{owner:'owner',admins:['admin']});for(const uid of ['owner','admin','member']){const access=token();sessions[uid]=access;await tx.put('user:'+uid,{uid,username:uid,email:uid+'@example.com',status:'active',epoch:1,devices:[uid]});await tx.put('family:'+uid,{fid:uid,uid,epoch:1,revoked:false});await tx.put('access:'+hash(access),{uid,fid:uid,epoch:1,scope:'account',origin:config.origin,expires:2000});}});const staff=createStaff(service.accounts);return {store,service,sessions,run:(uid,path,body={})=>staff.run(sessions[uid],path,body,service.accounts.csrf(uid))};}
test('ordinary tickets get one AI reply; worker leases prevent duplicate answers',async()=>{
 const f=await setup(),t=await f.service.control.support(f.sessions.member,{subject:'Username',message:'Can I use a nickname?'});let calls=0;
 const ai=createSupportAutomation(f.service.accounts,async()=>{calls++;return {message:'Nicknames are welcome.',handoff:false};});
 await Promise.all([ai.process(t.id),ai.process(t.id)]);const row=await f.service.control.supportThread(f.sessions.member,t.id);
 assert.equal(calls,1);assert.equal(row.supportMode,'ai');assert.equal(row.aiPending,false);assert.equal(row.replies[0].sender,'ai');assert.equal(row.replies[0].actor,'Grove AI');
});
test('human requests route immediately and summarize without exposing private summary',async()=>{
 const f=await setup(),t=await f.service.control.support(f.sessions.member,{subject:'Help',message:'Hello'});
 await assert.rejects(f.service.control.requestHuman(f.sessions.admin,{id:t.id}),e=>e.status===404);
 await f.service.control.requestHuman(f.sessions.member,{id:t.id});
 const ai=createSupportAutomation(f.service.accounts,async({mode})=>{assert.equal(mode,'summary');return {summary:'User asked for a human to help.'};});await ai.process(t.id);
 const row=await f.store.get('ticket:'+t.id),safe=await f.service.control.supportThread(f.sessions.member,t.id);assert.equal(row.supportMode,'human');assert.equal(row.handoffSummary,'User asked for a human to help.');assert.equal(safe.handoffSummary,undefined);assert.equal((await f.store.get('user-ticket:'+t.id)).handoffSummary,undefined);
});
test('appeals, natural-language bans and restricted accounts always require humans',async()=>{
 for(const body of [{subject:'Review',message:'Please review',type:'appeal'},{subject:'Help',message:'I got banned'}]){
  const f=await setup(),t=await f.service.control.support(f.sessions.member,body),row=await f.store.get('ticket:'+t.id);assert.equal(row.supportMode,'human');assert.equal(row.type,'appeal');assert.equal(row.replies[0].message,appealInstruction);
  await f.run('admin','/tickets/reply',{id:t.id,operation:'claim'});await assert.rejects(f.run('admin','/tickets/reply',{id:t.id,operation:'ai'}),e=>e.status===409);
 }
 const f=await setup();await atomic(f.store,async tx=>{const u=await tx.get('user:member');await tx.put('user:member',{...u,status:'banned'});});const t=await f.service.control.support(f.sessions.member,{subject:'Help',message:'Hello'});assert.equal((await f.store.get('ticket:'+t.id)).supportMode,'human');
});
test('admin takeover discards in-flight AI answer and can hand ordinary ticket back',async()=>{
 const f=await setup(),t=await f.service.control.support(f.sessions.member,{subject:'Help',message:'Nickname question'});let release,started;const ready=new Promise(r=>started=r);
 const ai=createSupportAutomation(f.service.accounts,async()=>{started();return new Promise(r=>release=r);});const pending=ai.process(t.id);await ready;
 await f.run('admin','/tickets/reply',{id:t.id,operation:'claim'});release({message:'Late bot answer',handoff:false});assert.equal((await pending).stale,true);
 let row=await f.store.get('ticket:'+t.id);assert.equal(row.supportMode,'human');assert.ok(!row.replies.some(r=>r.message==='Late bot answer'));
 await assert.rejects(f.run('owner','/tickets/reply',{id:t.id,operation:'ai'}),e=>e.status===409);
 await f.run('admin','/tickets/reply',{id:t.id,operation:'ai'});row=await f.store.get('ticket:'+t.id);assert.equal(row.supportMode,'ai');assert.equal(row.claimedBy,null);assert.equal(row.aiPending,true);
});
test('new user reply supersedes pending generation; closure prevents late AI writes',async()=>{
 const f=await setup(),t=await f.service.control.support(f.sessions.member,{subject:'Help',message:'First'});let release,started;const ready=new Promise(r=>started=r),ai=createSupportAutomation(f.service.accounts,async()=>{started();return new Promise(r=>release=r);});const pending=ai.process(t.id);await ready;
 await f.service.control.replySupport(f.sessions.member,{id:t.id,message:'Updated question'});release({message:'Old answer',handoff:false});assert.equal((await pending).stale,true);
 await f.service.control.closeSupport(f.sessions.member,t.id);await ai.process(t.id);assert.equal((await f.store.get('ticket:'+t.id)).replies.filter(r=>r.sender==='ai').length,0);assert.equal(await f.store.get('support-ai-job:'+t.id),null);
});
test('provider failure hands off with fallback summary; plain-text human request bypasses AI reply',async()=>{
 const f=await setup(),t=await f.service.control.support(f.sessions.member,{subject:'Help',message:'I need help'});await createSupportAutomation(f.service.accounts,async()=>{throw Error('provider down');}).process(t.id);let row=await f.store.get('ticket:'+t.id);assert.equal(row.supportMode,'human');assert.ok(row.handoffSummary.includes('I need help'));assert.equal(row.aiPending,false);
 await f.service.control.closeSupport(f.sessions.member,t.id);const next=await f.service.control.support(f.sessions.member,{subject:'Help',message:'Please let me speak to a human'});assert.equal((await f.store.get('ticket:'+next.id)).supportMode,'human');
});

test('appeal recommendation is staff-only advice and never changes restriction',async()=>{
 for(const suggestion of ['accept','deny','review_deeper']){
 const f=await setup();await atomic(f.store,async tx=>{const u=await tx.get('user:member');await tx.put('user:member',{...u,status:'banned'});});
 const t=await f.service.control.support(f.sessions.member,{subject:'Appeal',message:'I visited Poki. I will not do it again.',type:'appeal'});
 const ai=createSupportAutomation(f.service.accounts,async input=>{assert.equal(input.appeal,true);return {summary:'User asks for review.',recommendation:suggestion,rationale:'Check the user claim against the evidence.'};});await ai.process(t.id);
 const row=await f.store.get('ticket:'+t.id);assert.equal(row.appealRecommendation,suggestion);assert.equal(row.supportMode,'human');assert.equal(row.status,'open');assert.equal((await f.store.get('user:member')).status,'banned');
 const safe=await f.service.control.supportThread(f.sessions.member,t.id);assert.equal(safe.appealRecommendation,undefined);assert.equal(safe.appealRationale,undefined);assert.equal((await f.store.get('user-ticket:'+t.id)).appealRecommendation,undefined);
 const listed=await f.service.control.ownedList(f.sessions.member,'tickets');assert.equal(listed.items[0].appealRecommendation,undefined);
 await f.service.control.replySupport(f.sessions.member,{id:t.id,message:'More details.'});assert.equal((await f.store.get('ticket:'+t.id)).appealRecommendation,'review_deeper');
 await createSupportAutomation(f.service.accounts,async()=>{throw Error('Unavailable');}).process(t.id);assert.equal((await f.store.get('ticket:'+t.id)).appealRecommendation,'review_deeper');
 }
});
