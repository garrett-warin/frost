import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlatformService} from '../platform/http.mjs';
import {createStaff} from '../platform/staff.mjs';
import {dispatchOwner} from '../platform/owner.mjs';
import {cleanVisit,historyRetention} from '../platform/browsing-history.mjs';
import {reportVisit} from '../public/browsing-history.mjs';
import {signInternal} from '../platform/internal.mjs';
import {memoryStore} from './helpers/platform-store.mjs';
import {hash,token} from '../platform/security.mjs';
import {termsVersion} from '../platform/terms-document.mjs';

function fixture(){
 const store=memoryStore(),time={value:1800000000},origin='https://browse.example',config={origin:'https://accounts.example',endpoints:[origin],assignedOnly:true,internalSecret:'a'.repeat(64),browseSecret:'b'.repeat(64),termsVersion};
 const service=createPlatformService({store,config,now:()=>time.value}),uid='fr_11111111-1111-1111-1111-111111111111',browse=token(),account=token(),refresh=token();
 store.rows.set('user:'+uid,{uid,email:'synthetic@example.com',username:'synthetic',status:'active',epoch:1,devices:['family'],termsAcceptedVersion:termsVersion});
 store.rows.set('family:family',{fid:'family',uid,epoch:1,authAt:time.value});
 store.rows.set('assignment:'+uid,{origin});
 for(const [kind,value,scope] of [['access',browse,'browse'],['access',account,'account'],['refresh',refresh,'account']])store.rows.set(kind+':'+hash(value),{uid,fid:'family',epoch:1,scope,origin:scope==='browse'?origin:config.origin,expires:time.value+4000000});
 for(const row of store.rows.values())row._v=1;
 return {...service,store,time,origin,config,uid,browse,account,refresh};
}
const visit={url:'https://user:password@example.com/path?secret=value#token',title:'Synthetic page'};
test('visits are sanitized, account-bound, deduplicated and use server time',async()=>{
 const f=fixture();await f.browsingHistory.record(f.browse,f.origin,{...visit,uid:'other',recordedAt:1});await f.browsingHistory.record(f.browse,f.origin,visit);
 const result=await f.browsingHistory.read({uid:f.uid});assert.deepEqual(result.items,[{url:'https://example.com/path',title:visit.title,recordedAt:f.time.value}]);assert.equal(f.store.rows.has('browsing-history:other'),false);
 assert.throws(()=>cleanVisit({...visit,url:'javascript:alert(1)'}));assert.throws(()=>cleanVisit({...visit,title:'x'.repeat(301)}));assert.throws(()=>cleanVisit(null));
});
test('recording rejects missing consent, wrong scope/origin, reassignment, restrictions and revocation',async()=>{
 for(const change of [f=>f.store.rows.get('user:'+f.uid).termsAcceptedVersion='old',f=>f.store.rows.get('user:'+f.uid).status='banned',f=>f.store.rows.get('family:family').revoked=true,f=>f.store.rows.get('assignment:'+f.uid).origin='https://other.example']){
  const f=fixture();change(f);await assert.rejects(f.browsingHistory.record(f.browse,f.origin,visit));assert.equal(f.store.rows.has('browsing-history:'+f.uid),false);
 }
 const f=fixture();await assert.rejects(f.browsingHistory.record(f.account,f.origin,visit));await assert.rejects(f.browsingHistory.record(f.browse,'https://other.example',visit));
});
test('history is capped at 100, expires from reads, and account deletion removes storage',async()=>{
 const f=fixture();for(let i=0;i<105;i++){f.time.value+=4;await f.browsingHistory.record(f.browse,f.origin,{url:'https://example.com/'+i,title:'Visit '+i});}
 let data=await f.browsingHistory.read({uid:f.uid});assert.equal(data.items.length,100);assert.equal(data.items[0].url,'https://example.com/104');
 f.time.value+=historyRetention;assert.deepEqual((await f.browsingHistory.read({uid:f.uid})).items,[]);assert.equal(f.store.rows.has('browsing-history:'+f.uid),false);
 const g=fixture();await g.browsingHistory.record(g.browse,g.origin,visit);await g.control.deleteAccount(g.account);assert.equal(g.store.rows.has('browsing-history:'+g.uid),false);await assert.rejects(g.browsingHistory.read({uid:g.uid}));
});
test('recording rate limit bounds abusive clients',async()=>{
 const f=fixture();for(let i=0;i<60;i++)await f.browsingHistory.record(f.browse,f.origin,{url:'https://example.com/'+i,title:'Visit'});
 await assert.rejects(f.browsingHistory.record(f.browse,f.origin,visit),e=>e.status===429);
});
test('staff view requires role and CSRF, audits access, and revoked roles cannot read',async()=>{
 const f=fixture(),staff=createStaff(f.accounts),body={uid:f.uid},csrf=f.accounts.csrf('family');
 await assert.rejects(staff.run(f.account,'/accounts/history',body,csrf),e=>e.status===403);
 f.store.rows.set('staff-roster',{owner:'other',admins:[f.uid],_v:1});await assert.rejects(staff.run(f.account,'/accounts/history',body,'wrong'),e=>e.status===403);
 await staff.run(f.account,'/accounts/history',body,csrf);const audit=await f.store.list('audit');assert.equal(audit.items.length,1);assert.equal(audit.items[0].actor,f.uid);assert.equal(audit.items[0].action,'history:view');
 f.store.rows.get('staff-roster').admins=[];await assert.rejects(staff.run(f.account,'/accounts/history',body,csrf),e=>e.status===403);
 assert.equal(await dispatchOwner({source:'frost.admin',action:'browsing-history',body,requestContext:{}},f),null);
 assert.equal((await dispatchOwner({source:'frost.admin',action:'browsing-history',body},f)).statusCode,200);
});
test('signed internal history accepts only browsing secret and registered origin; public reads denied',async()=>{
 const f=fixture(),path='/internal/history',body=JSON.stringify({access:f.browse,origin:f.origin,visit});
 const event={rawPath:path,requestContext:{http:{method:'POST'}},body};
 assert.equal((await f.handler({...event,headers:signInternal(f.config.internalSecret,path,body,f.time.value)})).statusCode,401);
 assert.equal((await f.handler({...event,headers:signInternal(f.config.browseSecret,path,body,f.time.value)})).statusCode,200);
 assert.equal((await f.handler({rawPath:'/api/admin/accounts/history',requestContext:{http:{method:'POST'}},headers:{origin:f.config.origin,'content-type':'application/json'},body:JSON.stringify({uid:f.uid})})).statusCode,401);
});
test('client sends one sanitized new visit and tolerates delivery failure',async()=>{
 const calls=[];await reportVisit(visit,async(...args)=>{calls.push(args);return Response.json({ok:true});});assert.equal(calls.length,1);assert.equal(calls[0][0],'/api/account/history');assert.deepEqual(JSON.parse(calls[0][1].body),{url:'https://example.com/path',title:visit.title});
 await reportVisit({...visit,url:'data:text/html,test'},async()=>assert.fail('unsupported URL sent'));
 await reportVisit(visit,async()=>{throw Error('offline');});
});
