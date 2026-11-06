import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createAdminService,totp} from '../admin/service.mjs';
function fixture(owner){let clock=1800000000000;const rows=new Map([['config',{origin:'https://admin.test'}]]);const store={async get(k){return rows.get(k)},async put(k,v){rows.set(k,{...v})},async create(k,v){if(rows.has(k))return false;rows.set(k,{...v});return true},async remove(k){rows.delete(k)},async attempt(minute){const k='rate'+minute,n=(rows.get(k)||0)+1;rows.set(k,n);return n<=5},async consume(counter,enroll){const auth=rows.get('auth');if(auth.lastCounter>=counter)return false;auth.lastCounter=counter;if(enroll)auth.enrolled=true;return true}};const handler=createAdminService({store,assets:{},owner,setupHash:createHash('sha256').update('owner-setup').digest('hex'),now:()=>clock});const call=async(path,body={},headers={})=>{const r=await handler({rawPath:path,requestContext:{http:{method:'POST'}},headers:{origin:'https://admin.test','content-type':'application/json',...headers},body:JSON.stringify(body)});return {status:r.statusCode,data:JSON.parse(r.body)}};return {call,rows,handler,tick:()=>clock+=30000,code:()=>totp(rows.get('auth').secret).generate({timestamp:clock})};}
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

test('new account controls and analytics require valid TOTP session and exact origin',async()=>{
 const calls=[],f=fixture(async(action,body)=>{calls.push({action,body});return {statusCode:200,data:{ok:true}}});
 for(const path of ['/dashboard','/accounts','/accounts/action','/activity','/tickets/reply','/links','/links/action','/accounts/assign','/browsers/refresh','/verification/responses'])assert.equal((await f.call(path)).status,401);
 const setup={'x-frost-setup':'owner-setup'};await f.call('/setup/start',{},setup);const login=await f.call('/setup/confirm',{code:f.code()},setup),session={'x-frost-session':login.data.session};
 assert.equal((await f.call('/accounts/action',{uid:'test',action:'ban',reason:'test'},{...session,origin:'https://evil.test'})).status,403);assert.equal(calls.length,0);
 assert.equal((await f.call('/dashboard',{range:'week'},session)).status,200);assert.equal(calls.at(-1).action,'dashboard');
 assert.equal((await f.call('/browsers/refresh',{scope:'all',confirmAll:true,reason:'Deploy'},session)).status,200);assert.equal(calls.at(-1).action,'refresh');
 assert.equal((await f.call('/browsers/refresh',{scope:'all'},{...session,origin:'https://evil.test'})).status,403);
 assert.equal((await f.call('/accounts/action',{uid:'test',action:'ban',reason:'test'},session)).status,200);assert.equal(calls.at(-1).action,'user');
 assert.equal((await f.call('/activity',{kind:'users'},session)).status,400);
 await f.call('/logout',{},session);assert.equal((await f.call('/accounts',{},session)).status,401);
});

test('new-tab note requires administrator access and does not overwrite announcements',async()=>{
 const f=fixture(),setup={'x-frost-setup':'owner-setup'};
 assert.equal((await f.call('/note/publish',{note:'Hello'})).status,401);
 await f.call('/setup/start',{},setup);
 const login=await f.call('/setup/confirm',{code:f.code()},setup),session={'x-frost-session':login.data.session};
 await f.call('/publish',{message:'Banner'},session);
 assert.equal((await f.call('/note/publish',{note:'x'.repeat(161)},session)).status,400);
 assert.equal((await f.call('/note/publish',{note:4},session)).status,400);
 assert.equal((await f.call('/note/publish',{note:'No'},{...session,origin:'https://other.test'})).status,403);
 assert.equal((await f.call('/note/publish',{note:' <b>hello</b> '},session)).status,200);
 const read=async()=>JSON.parse((await f.handler({rawPath:'/announcement',requestContext:{http:{method:'GET'}}})).body);
 assert.deepEqual(await read(),{message:'Banner',note:'<b>hello</b>',maintenance:{enabled:false}});
 await f.call('/note/publish',{note:''},session);
 assert.deepEqual(await read(),{message:'Banner',note:'',maintenance:{enabled:false}});
});

test('maintenance publishing is authenticated, validates dates and preserves other notices',async()=>{
 const f=fixture(),setup={'x-frost-setup':'owner-setup'},value={enabled:true,startsAt:1800000060000,endsAt:1800003600000,reason:'Upgrading servers'};
 assert.equal((await f.call('/maintenance/publish',value)).status,401);
 await f.call('/setup/start',{},setup);const login=await f.call('/setup/confirm',{code:f.code()},setup),session={'x-frost-session':login.data.session};
 assert.equal((await f.call('/maintenance/publish',value,{...session,origin:'https://other.test'})).status,403);
 assert.equal((await f.call('/maintenance/publish',{...value,endsAt:0},session)).status,400);
 assert.equal((await f.call('/maintenance/publish',value,session)).status,200);
 await f.call('/publish',{message:'Hello'},session);
 assert.deepEqual(f.rows.get('maintenance'),{...value,type:'maintenance'});
 assert.equal((await f.call('/maintenance/publish',{enabled:false},session)).status,200);
 assert.deepEqual(f.rows.get('maintenance'),{enabled:false});assert.equal(f.rows.get('announcement').message,'Hello');
});

