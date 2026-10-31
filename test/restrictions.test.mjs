import test from 'node:test';
import assert from 'node:assert/strict';
import {effectiveUser} from '../platform/restrictions.mjs';
import {createAccounts} from '../platform/accounts.mjs';
import {createControl} from '../platform/control.mjs';
import {createAnalytics} from '../platform/analytics.mjs';
import {createStaff} from '../platform/staff.mjs';
import {memoryStore} from './helpers/platform-store.mjs';
import {hash,token} from '../platform/security.mjs';
const uid='fr_00000000-0000-0000-0000-000000000001',owner='fr_00000000-0000-0000-0000-000000000002';
function fixture(){
 const store=memoryStore(),now=1000,config={origin:'https://dispenser.example',internalSecret:'a'.repeat(64),endpoints:['https://one.example','https://two.example']};
 const accounts=createAccounts({store,config,now:()=>now}),control=createControl(accounts);
 store.rows.set('user:'+uid,{_v:1,kind:'users',sort:'1',uid,username:'expired',email:'expired@example.com',status:'suspended',restrictionUntil:1000,restrictionReason:'Temporary',epoch:2});
 return {store,accounts,control,config};
}
test('effective expiry does not mutate storage, reduce epoch, remove rename requirement or expire bans/legacy suspensions',()=>{
 const raw={status:'suspended',restrictionUntil:1000,restrictionReason:'Temporary',epoch:7,usernameChangeRequired:true};
 assert.equal(effectiveUser(raw,999).status,'suspended');
 const active=effectiveUser(raw,1000);assert.equal(active.status,'active');assert.equal(active.epoch,7);assert.equal(active.usernameChangeRequired,true);assert.equal(raw.status,'suspended');
 for(const restrictionUntil of [null,undefined,0,-1,Infinity,NaN,1000.1,'1000'])assert.equal(effectiveUser({...raw,restrictionUntil},2000).status,'suspended');
 assert.equal(effectiveUser({...raw,status:'banned'},2000).status,'banned');
});
test('admin status filter and browser refresh honor an expired suspension before any user-row materialization',async()=>{
 const f=fixture(),analytics=createAnalytics(f.accounts);
 assert.equal((await analytics.listUsers({status:'active'})).total,1);
 assert.equal((await analytics.listUsers({status:'suspended'})).total,0);
 assert.equal((await f.store.get('user:'+uid)).status,'suspended');
 const result=await f.control.admin('refresh',{scope:'account',uid,reason:'Update browser'});
 assert.equal(result.revision,1);assert.equal((await f.store.get('user:'+uid)).epoch,2);
});
test('staff addition recognizes a target expired suspension without requiring the target to log in',async()=>{
 const f=fixture(),access=token(),fid='owner-family';
 f.store.rows.set('user:'+owner,{_v:1,uid:owner,status:'active',epoch:1});
 f.store.rows.set('family:'+fid,{_v:1,uid:owner,fid,epoch:1,revoked:false});
 f.store.rows.set('access:'+hash(access),{_v:1,uid:owner,fid,epoch:1,expires:1900,scope:'account',origin:f.config.origin});
 f.store.rows.set('staff-roster',{_v:1,owner,admins:[]});
 await createStaff(f.accounts).run(access,'/staff/change',{action:'add',uid,reason:'Add reviewer'},f.accounts.csrf(fid));
 assert.ok((await f.store.get('staff-roster')).admins.includes(uid));
});
test('link rebalance includes an expired suspension that is still stored as suspended',async()=>{
 const f=fixture(),[origin,destination]=f.config.endpoints;
 f.store.rows.set('endpoint:'+hash(origin),{_v:1,origin,blocked:true,observed:'operational',assignments:1});
 f.store.rows.set('endpoint:'+hash(destination),{_v:1,origin:destination,observed:'operational',assignments:0});
 f.store.rows.set('assignment:'+uid,{_v:1,uid,origin});
 f.store.rows.set('link-job:'+hash(origin),{_v:1,id:'job',kind:'link-jobs',sort:'1',origin,cursor:null});
 assert.equal((await f.control.rebalance()).moved,1);
 assert.equal((await f.store.get('assignment:'+uid)).origin,destination);
});
