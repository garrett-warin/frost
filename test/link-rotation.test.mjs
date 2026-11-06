import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlatformService} from '../platform/http.mjs';
import {memoryStore} from './helpers/platform-store.mjs';
import {token,hash} from '../platform/security.mjs';
import {atomic} from '../platform/store.mjs';
async function fixture(){
 let time=1800000000;const store=memoryStore(),config={origin:'https://accounts.example',internalSecret:'i'.repeat(64),formsSecret:'f'.repeat(64),formId:'test',formUrl:'https://docs.google.com/forms/d/e/test/viewform',endpoints:['https://a.example','https://b.example','https://c.example']};
 const service=createPlatformService({store,config,now:()=>time});
 for(const origin of config.endpoints)await service.control.admin('endpoint',{origin,action:'operational',reason:'Fixture'});
 async function member(name){const pending=await service.accounts.register({email:name+'@example.com',username:name},name);await service.accounts.verifiedEvent({formId:'test',eventId:token(),email:name+'@example.com',correlation:pending.siteCode});const session=await service.accounts.completeRegistration(pending.poll,name);const user=await service.accounts.me(session.access);await service.control.allocate(session.access);return {session,user};}
 const a=await member('member_a');return {service,store,config,a,member,advance:seconds=>time+=seconds};
}
test('rotation requires confirmation, changes only own assignment and enforces seven days across sessions',async()=>{
 const f=await fixture(),{control,accounts}=f.service,b=await f.member('member_b');const before=await control.assignment(f.a.session.access),other=await control.assignment(b.session.access);
 await assert.rejects(control.rotateLink(f.a.session.access,{}),e=>e.status===400);
 const next=await control.rotateLink(f.a.session.access,{confirmed:true});assert.notEqual(next.origin,before.origin);assert.equal(next.rotationAvailableAt,1800000000+604800);
 assert.deepEqual(await control.assignment(b.session.access),other);
 await assert.rejects(control.rotateLink(f.a.session.access,{confirmed:true}),e=>e.status===429);
 f.advance(604799);let renewed=await accounts.refresh(f.a.session.refresh);await assert.rejects(control.rotateLink(renewed.access,{confirmed:true}),e=>e.status===429);
 f.advance(1);assert.notEqual((await control.rotateLink(renewed.access,{confirmed:true})).origin,next.origin);
 const rows=await Promise.all(f.config.endpoints.map(origin=>f.store.get('endpoint:'+hash(origin))));assert.equal(rows.reduce((n,r)=>n+r.assignments,0),2);
});
test('concurrent requests rotate once; unavailable replacements do not consume allowance',async()=>{
 const f=await fixture(),{control}=f.service;const results=await Promise.allSettled([control.rotateLink(f.a.session.access,{confirmed:true}),control.rotateLink(f.a.session.access,{confirmed:true})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const g=await fixture(),current=await g.service.control.assignment(g.a.session.access);
 for(const origin of g.config.endpoints.filter(o=>o!==current.origin))await g.service.control.admin('endpoint',{origin,action:'retired',reason:'Fixture'});
 await assert.rejects(g.service.control.rotateLink(g.a.session.access,{confirmed:true}),e=>e.status===503);
 assert.equal((await g.store.get('user:'+g.a.user.frostId)).linkRotationAvailableAt,undefined);
});
test('rotation rejects missing authentication, CSRF and restricted accounts',async()=>{
 const f=await fixture(),event={rawPath:'/api/assignment/rotate',requestContext:{http:{method:'POST'}},headers:{origin:f.config.origin,'content-type':'application/json'},body:JSON.stringify({confirmed:true})};
 assert.equal((await f.service.handler(event)).statusCode,401);
 event.cookies=['__Host-frost-account='+f.a.session.access,'__Host-frost-refresh='+f.a.session.refresh];assert.equal((await f.service.handler(event)).statusCode,403);
 event.headers['x-frost-csrf']=f.a.session.csrf;assert.equal((await f.service.handler(event)).statusCode,200);
 await atomic(f.store,async tx=>{const key='user:'+f.a.user.frostId,row=await tx.get(key);await tx.put(key,{...row,status:'banned'});});
 await assert.rejects(f.service.control.rotateLink(f.a.session.access,{confirmed:true}),e=>e.status===403);
});

