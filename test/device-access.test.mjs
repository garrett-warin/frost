import test from 'node:test';
import assert from 'node:assert/strict';
import {createDeviceAccess,validDevice} from '../device-access.mjs';
const id='ed9e663c-40c6-46d4-97a4-142bb4897c85';
test('device cookies are host-only HttpOnly, strictly validated, and statuses expire',async()=>{
 let cookie,clock=0,blocked=false,calls=0;
 const access=createDeviceAccess({adminOrigin:'https://admin.test',now:()=>clock,fetchStatus:async()=>{calls++;return {ok:true,json:async()=>({banned:blocked})};}});
 const issued=access.issue({setHeader:(name,value)=>cookie=value});
 assert.ok(validDevice(issued));assert.match(cookie,/^__Host-frost-device=/);assert.match(cookie,/HttpOnly/);assert.match(cookie,/; Secure/);assert.doesNotMatch(cookie,/Domain=/);
 assert.equal(access.read({headers:{cookie:'a=b; __Host-frost-device='+id}}),id);
 assert.equal(access.read({headers:{cookie:'__Host-frost-device=bad'}}),null);
 assert.equal(await access.banned(id),false);blocked=true;
 assert.equal(await access.banned(id),false);assert.equal(calls,1);
 clock=10001;assert.equal(await access.banned(id),true);assert.equal(calls,2);
 await assert.rejects(access.banned(null));
});
test('device access fails closed when remote status is unavailable or malformed',async()=>{
 for(const fetchStatus of [async()=>{throw new Error('offline')},async()=>({ok:false}),async()=>({ok:true,json:async()=>({})})]){
  const access=createDeviceAccess({adminOrigin:'https://admin.test',fetchStatus});
  await assert.rejects(access.banned(id));
 }
});
