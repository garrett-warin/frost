import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {request as httpRequest} from 'node:http';
import WebSocket from 'ws';
import {createFrostServer} from '../server.mjs';
import {createPlatformService} from '../platform/http.mjs';
import {memoryStore} from './helpers/platform-store.mjs';
import {token,hmac} from '../platform/security.mjs';
import {signInternal} from '../platform/internal.mjs';

async function fixture(t,{aiFetch}={}){
 const publicOrigin='https://frost-browsing.fly.dev',mirror='https://dtest.cloudfront.net',other='https://dother.cloudfront.net';
 const internalSecret='i'.repeat(64),browseSecret=hmac(internalSecret,'browse-gate-v1');
 const config={origin:'https://accounts.example',internalSecret,browseSecret,formsSecret:'f'.repeat(64),formUrl:'https://docs.google.com/forms/d/e/test/viewform',formId:'test',endpoints:[publicOrigin,mirror,other],assignedOnly:true};
 const service=createPlatformService({store:memoryStore(),config});let offline=false;
 const accountFetch=async(url,options)=>{if(offline)throw Error('Simulated service outage');const r=await service.handler({rawPath:new URL(url).pathname,headers:options.headers,body:options.body,requestContext:{http:{method:'POST',sourceIp:'127.0.0.1'}}});return new Response(r.body,{status:r.statusCode,headers:r.headers});};
 for(const origin of config.endpoints)await service.control.admin('endpoint',{origin,action:'operational',reason:'Test fixture'});
 const pending=await service.accounts.register({email:'gate@example.com',username:'gate_user'},'test');
 await service.accounts.verifiedEvent({formId:'test',eventId:token(),email:'gate@example.com',correlation:pending.siteCode});
 const account=await service.accounts.completeRegistration(pending.poll,'test'),user=await service.accounts.me(account.access);await service.accounts.acceptTerms(account.access,{accept:true,version:user.terms.version});
 await service.control.admin('assign',{uid:user.frostId,origin:mirror,reason:'Fixture mirror'});
 const binding=token(),handoff=await service.accounts.createHandoff(account.access,mirror,binding),browse=await service.accounts.redeem(handoff.code,mirror,binding);
 const cookie='__Host-frost-browse='+browse.access+'; __Host-frost-browse-refresh='+browse.refresh;
 const savedFetch=globalThis.fetch,savedEnv=Object.fromEntries(['FROST_AI_PROVIDER','GROQ_API_KEY','FROST_AI_MODELS'].map(k=>[k,process.env[k]]));let app;
 try{
  if(aiFetch){globalThis.fetch=aiFetch;process.env.FROST_AI_PROVIDER='groq';process.env.GROQ_API_KEY='synthetic-test-key';process.env.FROST_AI_MODELS='openai/gpt-oss-20b';}
  app=createFrostServer({publicOrigin,edgeOrigins:[mirror,other].join(','),dispenserOrigin:config.origin,accountSecret:browseSecret,accountFetch,accountCheckMs:30,adminOrigin:''});
 }finally{globalThis.fetch=savedFetch;for(const [key,value] of Object.entries(savedEnv)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
 app.listen(0,'127.0.0.1');await once(app,'listening');
 const local='http://127.0.0.1:'+app.address().port,sockets=[];
 t.after(async()=>{for(const ws of sockets)ws.terminate();app.closeAllConnections();await new Promise(resolve=>app.close(resolve));});
 const request=(path,{credential=cookie,origin=mirror,method='GET',body}={})=>new Promise((resolve,reject)=>{
  const req=httpRequest(local+path,{method,headers:{Host:'frost-browsing.fly.dev','x-frost-viewer-origin':origin,origin,...(credential?{cookie:credential}:{}),...(body?{'content-type':'application/json'}:{})}},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers:res.headers})));});req.on('error',reject);req.end(body);
 });
 async function connect({credential=cookie,origin=mirror,viewer=origin}={}){
  const ws=new WebSocket(local.replace('http:','ws:')+'/relay/',{origin,headers:{Host:'frost-browsing.fly.dev','x-frost-viewer-origin':viewer,...(credential?{Cookie:credential}:{})}});sockets.push(ws);ws.on('error',()=>{});
  const status=await new Promise(resolve=>{ws.once('open',()=>resolve(101));ws.once('unexpected-response',(_,res)=>{res.resume();ws.terminate();resolve(res.statusCode);});});return {ws,status};
 }
 return {request,connect,service,user,config,browseSecret,mirror,other,local,cookie,offline:()=>{offline=true;}};
}

test('real server requires grants, returns minimal status, and never mounts privileged account APIs',{timeout:10000},async t=>{
 const f=await fixture(t);
 const missing=await f.request('/api/account/status',{credential:''});assert.equal(missing.status,401);assert.equal((await missing.json()).redirect,f.config.origin+'/?verify=1');
 assert.equal((await f.connect({credential:''})).status,401);
 const valid=await f.request('/api/account/status');assert.equal(valid.status,200);assert.deepEqual(await valid.json(),{allowed:true});
 assert.equal((await f.request('/')).status,200);
 for(const path of ['/api/account/session','/api/account/vault','/api/account/preferences'])for(const method of ['GET','POST'])assert.equal((await f.request(path,{method,body:method==='POST'?'{}':undefined})).status,404);
 // The Fly-derived key cannot call storage even if someone adds a route later.
 const path='/internal/vault',body=JSON.stringify({origin:f.mirror,access:token()});
 const result=await f.service.handler({rawPath:path,requestContext:{http:{method:'POST'}},headers:signInternal(f.browseSecret,path,body),body});assert.equal(result.statusCode,401);
});

test('bans deny new relay and AI requests and terminate already-connected sockets',{timeout:10000},async t=>{
 const f=await fixture(t),connection=await f.connect();assert.equal(connection.status,101);
 const closed=once(connection.ws,'close');await f.service.control.admin('user',{uid:f.user.frostId,action:'ban',reason:'Integration test'});
 await closed;
 assert.equal((await f.connect()).status,403);
 const status=await f.request('/api/account/status');assert.equal(status.status,403);assert.equal((await status.json()).redirect,f.config.origin+'/appeal');
 const ai=await f.request('/api/frosty/chat',{method:'POST',body:'{}'});assert.equal(ai.status,403);assert.equal((await ai.json()).redirect,f.config.origin+'/appeal');
});

test('mirror grant scopes and viewer-origin disagreement fail closed',{timeout:10000},async t=>{
 const f=await fixture(t);
 assert.equal((await f.request('/api/account/status',{origin:f.other})).status,401);
 assert.equal((await f.connect({origin:f.other})).status,401);
 assert.notEqual((await f.connect({origin:f.mirror,viewer:f.other})).status,101);
 const valid=await f.connect();assert.equal(valid.status,101);
 const closed=once(valid.ws,'close');await f.service.control.admin('assign',{uid:f.user.frostId,origin:f.other,reason:'Move assignment'});await closed;
 const old=await f.request('/api/account/status');assert.equal(old.status,403);assert.equal((await old.json()).redirect,f.config.origin+'/');
});

test('account outage terminates active connections; missing AI auth is rejected before provider handling',{timeout:10000},async t=>{
 const f=await fixture(t);
 const ai=await f.request('/api/frosty/chat',{credential:'',method:'POST',body:'{}'});assert.equal(ai.status,401);
 const valid=await f.connect();assert.equal(valid.status,101);const closed=once(valid.ws,'close');f.offline();await closed;
 assert.equal((await f.connect()).status,503);const status=await f.request('/api/account/status');assert.equal(status.status,503);assert.equal((await status.json()).redirect,undefined);
 assert.equal((await f.request('/api/frosty/chat',{method:'POST',body:'{}'})).status,503);
});

test('account ban cuts an active AI response and aborts its synthetic provider stream',{timeout:10000},async t=>{
 let upstreamAborted=false,resolveAbort;const aborted=new Promise(resolve=>{resolveAbort=resolve;});
 const aiFetch=async(url,{signal})=>{
  assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');
  return new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"hello"}}]}\n\n'));signal.addEventListener('abort',()=>{upstreamAborted=true;controller.error(new Error('Aborted by account gate'));resolveAbort();},{once:true});}}),{status:200});
 };
 const f=await fixture(t,{aiFetch});
 const response=await new Promise((resolve,reject)=>{
  const req=httpRequest(f.local+'/api/frosty/chat',{method:'POST',headers:{Host:'frost-browsing.fly.dev',origin:f.mirror,'x-frost-viewer-origin':f.mirror,'content-type':'application/json',cookie:f.cookie+'; __Host-frost-device=ed9e663c-40c6-46d4-97a4-142bb4897c85'}},resolve);req.on('error',reject);req.end(JSON.stringify({model:'openai/gpt-oss-20b',messages:[{role:'user',content:'hello'}]}));
 });
 assert.equal(response.statusCode,200);response.on('error',()=>{});response.resume();
 const closed=new Promise(resolve=>response.once('close',resolve));
 await f.service.control.admin('user',{uid:f.user.frostId,action:'ban',reason:'Stop active AI'});await closed;await aborted;
 assert.equal(upstreamAborted,true);
});

test('initializing a device preserves simultaneously rotated browsing cookies',{timeout:10000},async t=>{
 const f=await fixture(t),credential=f.cookie.replace(/__Host-frost-browse=[^;]+/,'__Host-frost-browse='+token());
 const response=await f.request('/api/device',{credential});assert.equal(response.status,200);
 const cookies=response.headers.get('set-cookie');
 assert.match(cookies,/__Host-frost-device=/);assert.match(cookies,/__Host-frost-browse=/);assert.match(cookies,/__Host-frost-browse-refresh=/);
 const rotated=['__Host-frost-browse','__Host-frost-browse-refresh'].map(name=>name+'='+cookies.match(new RegExp(name+'=([^;,]+)'))[1]).join('; ');
 assert.equal((await f.request('/api/account/status',{credential:rotated})).status,200);
});

test('authenticated device polling delivers only that account’s refresh revisions',async t=>{
 const f=await fixture(t);
 const first=await f.request('/api/device');const firstData=await first.json();assert.deepEqual(firstData.refresh,{all:0,account:0});assert.deepEqual(firstData.account,{username:f.user.username,frostId:f.user.frostId});assert.equal(firstData.account.email,undefined);
 await f.service.control.admin('refresh',{scope:'account',uid:f.user.frostId,reason:'Deploy test'});
 const second=await f.request('/api/device');assert.deepEqual((await second.json()).refresh,{all:0,account:1});
 const anonymous=await f.request('/api/device',{credential:''});assert.equal(anonymous.status,401);assert.equal((await anonymous.json()).refresh,undefined);
});
