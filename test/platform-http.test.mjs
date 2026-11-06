import {readResponses,responseSheetId} from '../platform/verification-responses.mjs';
import {dispatchOwner} from '../platform/owner.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlatformService} from '../platform/http.mjs';
import {signInternal} from '../platform/internal.mjs';
import {memoryStore} from './helpers/platform-store.mjs';
import {token,hash,hmac} from '../platform/security.mjs';

function setup(assets={}){
 const config={origin:'https://accounts.example',internalSecret:'i'.repeat(64),formsSecret:'s'.repeat(64),formId:'verified-form',formUrl:'https://docs.google.com/forms/d/e/example/viewform',formEntry:'entry.123',endpoints:['https://frost.example'],assignedOnly:true,vaultKey:Buffer.alloc(32,3).toString('base64')};
 const now=()=>1700000000,service=createPlatformService({store:memoryStore(),config,now,assets});
 const event=(path,{method='GET',body,cookies=[],headers={}}={})=>({rawPath:path.split('?')[0],rawQueryString:path.split('?')[1]||'',requestContext:{http:{method,sourceIp:'127.0.0.1'}},headers:{origin:config.origin,'content-type':'application/json',...headers},cookies,body:body===undefined?'':JSON.stringify(body)});
 async function register(){const result=await service.handler(event('/api/register',{method:'POST',body:{username:'snow_user',email:'snow@example.com'}}));assert.equal(result.statusCode,200);const correlation=JSON.parse(result.body).siteCode,body={eventId:token(),formId:config.formId,email:'snow@example.com',correlation},raw=JSON.stringify(body),timestamp=String(now());const verified=await service.handler(event('/forms/verified',{method:'POST',body,headers:{'x-frost-time':timestamp,'x-frost-signature':hmac(config.formsSecret,`${timestamp}\n${hash(raw)}`)}}));assert.equal(verified.statusCode,200);const complete=await service.handler(event('/api/register/complete',{method:'POST',cookies:result.cookies.map(c=>c.split(';')[0])}));assert.equal(complete.statusCode,200);const sessionAccess=complete.cookies.find(c=>c.startsWith('__Host-frost-account=')).split(';')[0].split('=')[1];return {cookies:complete.cookies.filter(c=>!c.includes('Max-Age=0')).map(c=>c.split(';')[0]),csrf:JSON.parse(complete.body).csrf};}
 return {...service,config,now,event,register};
}

test('HTTP registration stores credentials only in secure host-only cookies and rejects CSRF',async()=>{
 const f=setup(),session=await f.register();const info=await f.handler(f.event('/api/me',session));assert.equal(info.statusCode,200);assert.equal(JSON.parse(info.body).username,'snow_user');
 const bad=await f.handler(f.event('/api/username',{...session,method:'POST',body:{username:'changed'},headers:{origin:'https://attacker.example','x-frost-csrf':session.csrf}}));assert.equal(bad.statusCode,403);
 const missing=await f.handler(f.event('/api/username',{...session,method:'POST',body:{username:'changed'}}));assert.equal(missing.statusCode,403);
 const good=await f.handler(f.event('/api/username',{...session,method:'POST',body:{username:'changed'},headers:{'x-frost-csrf':session.csrf}}));assert.equal(good.statusCode,200);
 const refreshed=await f.handler(f.event('/api/refresh',{...session,method:'POST',headers:{'x-frost-csrf':session.csrf}}));assert.equal(refreshed.statusCode,200);assert.equal(JSON.parse(refreshed.body).access,undefined);assert.equal(JSON.parse(refreshed.body).refresh,undefined);assert.ok(refreshed.cookies.every(c=>c.includes('Secure; HttpOnly; SameSite=Lax')&&!c.includes('Domain=')));
});

test('internal endpoints require body-bound signatures, reject replay, and return an appeals destination on ban',async()=>{
 const f=setup(),session=await f.register();const access=session.cookies.find(c=>c.startsWith('__Host-frost-account=')).split('=')[1];
 await f.control.admin('endpoint',{origin:f.config.endpoints[0],action:'operational',reason:'Verified'});await f.control.allocate(access);
 const binding=token(),handoff=await f.accounts.createHandoff(access,f.config.endpoints[0],binding),body={code:handoff.code,origin:f.config.endpoints[0],binding},raw=JSON.stringify(body),headers=signInternal(f.config.internalSecret,'/internal/redeem',raw,f.now());
 assert.equal((await f.handler(f.event('/internal/redeem',{method:'POST',body}))).statusCode,401);
 assert.equal((await f.handler(f.event('/internal/redeem',{method:'POST',body:{...body,binding:token()},headers}))).statusCode,401);
 const redeemed=await f.handler(f.event('/internal/redeem',{method:'POST',body,headers}));assert.equal(redeemed.statusCode,200);assert.equal((await f.handler(f.event('/internal/redeem',{method:'POST',body,headers}))).statusCode,401);
 const browser=JSON.parse(redeemed.body),user=await f.accounts.me(access);await f.control.admin('user',{uid:user.frostId,action:'ban',reason:'Verified ban'});
 const check={origin:f.config.endpoints[0],access:browser.access};const banned=await f.handler(f.event('/internal/check',{method:'POST',body:check,headers:signInternal(f.config.internalSecret,'/internal/check',JSON.stringify(check),f.now())}));assert.equal(banned.statusCode,403);assert.equal(JSON.parse(banned.body).redirect,f.config.origin+'/appeal');
});

test('unsigned form events, duplicate cookies and removed OAuth fail closed',async()=>{
 const f=setup();assert.equal((await f.handler(f.event('/forms/verified',{method:'POST',body:{}}))).statusCode,401);
 assert.equal((await f.handler(f.event('/api/bootstrap',{cookies:['__Host-frost-refresh=a','__Host-frost-refresh=b']}))).statusCode,400);
 assert.equal((await f.handler(f.event('/oauth/start'))).statusCode,404);
 assert.equal((await f.handler(f.event('/api/username?name=frost_admin'))).statusCode,400);
});

test('general API burst protection returns retry delay without a verification cooldown',async()=>{
 const f=setup();let now=1700000000;const service=createPlatformService({store:memoryStore(),config:f.config,now:()=>now});
 const request=()=>service.handler(f.event('/api/verify',{method:'POST',body:{email:'retry@example.com'}}));
 for(let i=0;i<30;i++)assert.equal((await request()).statusCode,200);
 const limited=await request(),delay=60-now%60;assert.equal(limited.statusCode,429);assert.equal(JSON.parse(limited.body).retryAfter,delay);assert.equal(limited.headers['retry-after'],String(delay));
 now+=delay-1;assert.equal(JSON.parse((await request()).body).retryAfter,1);
 now++;assert.equal((await request()).statusCode,200);
});

test('unified entry uses the private verified poll cookie to finish a new profile',async()=>{
 const f=setup(),email='onepage@example.com',body={email,purpose:'email'};
 const bad=await f.handler(f.event('/api/entry',{method:'POST',body,headers:{origin:'https://attacker.example'}}));assert.equal(bad.statusCode,403);
 const pending=await f.handler(f.event('/api/entry',{method:'POST',body}));assert.equal(pending.statusCode,200);
 const cookies=pending.cookies.map(x=>x.split(';')[0]);
 assert.equal((await f.handler(f.event('/api/register/complete',{method:'POST',cookies,body:{username:'onepage'}}))).statusCode,409);
 const event={formId:f.config.formId,eventId:token(),email,correlation:JSON.parse(pending.body).siteCode},raw=JSON.stringify(event),timestamp=String(f.now());
 assert.equal((await f.handler(f.event('/forms/verified',{method:'POST',body:event,headers:{'x-frost-time':timestamp,'x-frost-signature':hmac(f.config.formsSecret,`${timestamp}\n${hash(raw)}`)}}))).statusCode,200);
 assert.equal(JSON.parse((await f.handler(f.event('/api/register/status',{cookies}))).body).status,'needs_username');
 const complete=await f.handler(f.event('/api/register/complete',{method:'POST',cookies,body:{username:'onepage'}}));assert.equal(complete.statusCode,200);assert.ok(complete.cookies.some(x=>x.startsWith('__Host-frost-account=')));
 assert.notEqual((await f.handler(f.event('/api/register/complete',{method:'POST',cookies,body:{username:'onepage'}}))).statusCode,200);
});

 test('derived browse key cannot invoke account storage endpoints',async()=>{
 const f=setup();f.config.browseSecret=hmac(f.config.internalSecret,'browse-gate-v1');
 for(const path of ['/internal/vault','/internal/preferences']){const body={origin:f.config.endpoints[0],access:token()};const result=await f.handler(f.event(path,{method:'POST',body,headers:signInternal(f.config.browseSecret,path,JSON.stringify(body),f.now())}));assert.equal(result.statusCode,401);}
 const body={origin:f.config.endpoints[0],access:token()},path='/internal/check';
 const rejected=await f.handler(f.event(path,{method:'POST',body,headers:signInternal(f.config.internalSecret,path,JSON.stringify(body),f.now())}));assert.equal(rejected.statusCode,401);
 });

test('sheet snapshots require path-bound signing, validate source, minimize data and never authenticate visitors',async()=>{
 const f=setup(),path='/forms/responses',body={kind:'sheet-responses-v1',sheetId:responseSheetId,formId:f.config.formId,capturedAt:f.now()*1000,total:1,rows:[{row:2,submittedAt:'10/26/2026 12:00',email:'demo@example.com',codeSuffix:'ABC123',secret:'do not store'}]};
 const send=(data,scope=path)=>f.handler(f.event(path,{method:'POST',body:data,headers:{'x-frost-time':String(f.now()),'x-frost-signature':hmac(f.config.formsSecret,`${f.now()}\n${scope?scope+'\n':''}${hash(JSON.stringify(data))}`)}}));
 assert.equal((await f.handler(f.event(path,{method:'POST',body}))).statusCode,401);
 assert.equal((await send(body,'')).statusCode,401);
 assert.equal((await send({...body,sheetId:'other'})).statusCode,400);
 assert.equal((await send({...body,rows:[{...body.rows[0],codeSuffix:token()}]})).statusCode,400);
 assert.equal((await send({...body,rows:Array(101).fill(body.rows[0]),total:101})).statusCode,400);
 assert.equal((await send(body)).statusCode,200);
 const data=await readResponses(f.accounts);assert.equal(data.total,1);assert.equal(data.rows[0].secret,undefined);assert.equal(data.rows[0].codeSuffix,'ABC123');
 assert.equal(JSON.parse((await send({...body,capturedAt:body.capturedAt-1,total:0,rows:[]})).body).ignored,true);
 assert.equal((await readResponses(f.accounts)).total,1);
 assert.equal(await dispatchOwner({...f.event('/verification/responses'),source:'frost.admin',action:'verification-responses'},f,null),null);
 assert.equal((await dispatchOwner({source:'frost.admin',action:'verification-responses'},f,null)).data.rows.length,1);
 assert.deepEqual(await f.accounts.bootstrap(token()),{signedIn:false});
});

test('retired editor and design APIs are unavailable even with assets present',async()=>{
 const f=setup({'/customize':{type:'text/html',body:'old editor'}});for(const path of ['/customize','/customize/editor.bundle.mjs','/api/design','/api/templates','/api/templates/publish','/internal/design','/api/admin/templates/list']){const r=await f.handler(f.event(path));assert.equal(r.statusCode,410,path);}
});


test('verification and registration have no shared-IP or hourly start cooldown',async()=>{
 const f=setup();
 for(let i=0;i<105;i++){
  assert.ok((await f.accounts.startVerification({email:'repeat@example.com',purpose:'entry'},'shared-ip')).siteCode);
  assert.ok((await f.accounts.register({email:`test${i}@example.com`,username:`test_${i}`},'shared-ip')).siteCode);
 }
});
