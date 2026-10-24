import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createAdminService,totp} from '../admin/service.mjs';
function fixture(){let clock=1800000000000;const rows=new Map([['config',{origin:'https://admin.test'}]]);const store={async get(k){return rows.get(k)},async put(k,v){rows.set(k,{...v})},async create(k,v){if(rows.has(k))return false;rows.set(k,{...v});return true},async remove(k){rows.delete(k)},async attempt(minute){const k='rate'+minute,n=(rows.get(k)||0)+1;rows.set(k,n);return n<=5},async consume(counter,enroll){const auth=rows.get('auth');if(auth.lastCounter>=counter)return false;auth.lastCounter=counter;if(enroll)auth.enrolled=true;return true}};const handler=createAdminService({store,assets:{},setupHash:createHash('sha256').update('owner-setup').digest('hex'),now:()=>clock});const call=async(path,body={},headers={})=>{const r=await handler({rawPath:path,requestContext:{http:{method:'POST'}},headers:{origin:'https://admin.test','content-type':'application/json',...headers},body:JSON.stringify(body)});return {status:r.statusCode,data:JSON.parse(r.body)}};return {call,rows,handler,tick:()=>clock+=30000,code:()=>totp(rows.get('auth').secret).generate({timestamp:clock})};}
test('TOTP enrollment, replay prevention, announcements, logout and expiry',async()=>{
 const f=fixture(),setup={'x-frost-setup':'owner-setup'};
 assert.equal((await f.call('/setup/start')).status,403);
 assert.equal((await f.call('/setup/start',{},setup)).status,200);
 assert.equal((await f.call('/publish',{message:'unauthorized'})).status,401);
 assert.equal((await f.call('/setup/confirm',{code:'bad'},setup)).status,401);
 const enrolled=await f.call('/setup/confirm',{code:f.code()},setup);assert.equal(enrolled.status,200);
 assert.equal((await f.call('/login',{code:f.code()})).status,401);
 assert.equal((await f.call('/setup/start',{},setup)).status,409);
 const session={'x-frost-session':enrolled.data.session};
 assert.equal((await f.call('/publish',{message:'Hello'},session)).status,200);
 assert.equal(f.rows.get('announcement').message,'Hello');
 assert.equal((await f.call('/publish',{message:'No'},{...session,origin:'https://frost-browsing.fly.dev'})).status,403);
 assert.equal((await f.call('/publish',{message:'x'.repeat(1001)},session)).status,400);
 assert.equal((await f.call('/logout',{},session)).status,200);
 assert.equal((await f.call('/publish',{message:'No'},session)).status,401);
 f.tick(); const next=await f.call('/login',{code:f.code()}); assert.equal(next.status,200);
 for(let i=0;i<31;i++)f.tick();
 assert.equal((await f.call('/publish',{message:'Expired'},{'x-frost-session':next.data.session})).status,401);
});
test('authentication attempts share an account-wide budget',async()=>{
 const f=fixture();await f.call('/setup/start',{}, {'x-frost-setup':'owner-setup'});
 for(let i=0;i<5;i++)assert.equal((await f.call('/setup/confirm',{code:'bad'},{'x-frost-setup':'owner-setup'})).status,401);
 assert.equal((await f.call('/setup/confirm',{code:f.code()},{'x-frost-setup':'owner-setup'})).status,429);
});
test('only the TOTP owner can ban/unban; public checks never reveal private notes',async()=>{
 const f=fixture(),device='ed9e663c-40c6-46d4-97a4-142bb4897c85',setup={'x-frost-setup':'owner-setup'};
 const body={device,reason:'Private moderation note'};
 assert.equal((await f.call('/device/ban',body)).status,401);
 await f.call('/setup/start',{},setup);
 const login=await f.call('/setup/confirm',{code:f.code()},setup);
 const session={'x-frost-session':login.data.session};
 assert.equal((await f.call('/device/ban',body,{...session,origin:'https://other.test'})).status,403);
 assert.equal((await f.call('/device/ban',{...body,device:'bad'},session)).status,400);
 assert.equal((await f.call('/device/ban',body,session)).data.banned,true);
 const publicCheck=()=>f.handler({rawPath:'/device/check/'+device,requestContext:{http:{method:'GET'}}});
 assert.deepEqual(JSON.parse((await publicCheck()).body),{banned:true});
 assert.equal((await f.call('/device/status',{device},session)).data.reason,body.reason);
 assert.equal((await f.call('/device/unban',{device},session)).data.banned,false);
 assert.deepEqual(JSON.parse((await publicCheck()).body),{banned:false});
});
