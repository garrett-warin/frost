import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createAccountAccess} from '../account-access.mjs';
import {token} from '../platform/security.mjs';

async function server(fetchService){
 const access=createAccountAccess({dispenserOrigin:'https://accounts.example',internalSecret:'x'.repeat(64),fetchService});
 const app=createServer(async(req,res)=>{if(!await access.handle(req,res,'https://frost.example'))res.writeHead(404).end();}).listen(0,'127.0.0.1');await once(app,'listening');
 return {origin:'http://127.0.0.1:'+app.address().port,close:async()=>{app.closeAllConnections();await new Promise(resolve=>app.close(resolve));}};
}
test('main-site sign-in binds callback to this browser and strips the one-time code',async()=>{
 const accessToken=token(),refreshToken=token();let received;
 const app=await server(async(url,request)=>{received=JSON.parse(request.body);return Response.json({access:accessToken,refresh:refreshToken,expiresIn:900,refreshExpiresIn:400*86400});});
 try{
  const start=await fetch(app.origin+'/auth/start',{redirect:'manual'});assert.equal(start.status,303);const redirect=new URL(start.headers.get('location'));assert.equal(redirect.origin,'https://accounts.example');assert.equal(redirect.searchParams.get('origin'),'https://frost.example');
  const bindingCookie=start.headers.getSetCookie()[0].split(';')[0],code=token();const complete=await fetch(app.origin+'/auth/callback?code='+code,{headers:{cookie:bindingCookie},redirect:'manual'});
  assert.equal(complete.status,303);assert.equal(complete.headers.get('location'),'/');assert.equal(received.code,code);assert.equal(received.binding,redirect.searchParams.get('binding'));assert.ok(complete.headers.getSetCookie().every(c=>c.includes('Secure; HttpOnly; SameSite=Lax')));
 }finally{await app.close();}
});
test('restricted accounts receive the dispenser appeal destination and cleared browsing credentials',async()=>{
 const app=await server(async()=>Response.json({code:'ACCOUNT_RESTRICTED',error:'Appeal this restriction.'},{status:403}));
 try{const response=await fetch(app.origin+'/api/account/status',{headers:{cookie:'__Host-frost-browse='+token()}});assert.equal(response.status,403);assert.equal((await response.json()).redirect,'https://accounts.example/appeal');assert.equal(response.headers.getSetCookie().length,2);assert.ok(response.headers.getSetCookie().every(c=>c.includes('Max-Age=0')));}
 finally{await app.close();}
});
test('account service outages never silently sign a visitor in or redirect them as banned',async()=>{
 const app=await server(async()=>{throw Error('offline');});try{const response=await fetch(app.origin+'/api/account/status',{headers:{cookie:'__Host-frost-browse='+token()}});assert.equal(response.status,503);assert.equal((await response.json()).redirect,undefined);}finally{await app.close();}
});

test('missing or expired device sign-in sends users to dispenser email verification',async()=>{
 const app=await server(async()=>Response.json({error:'Session expired.'},{status:401}));
 try{for(const cookie of ['', '__Host-frost-browse='+token()+'; __Host-frost-browse-refresh='+token()]){const response=await fetch(app.origin+'/api/account/status',{headers:{cookie}});assert.equal(response.status,401);assert.equal((await response.json()).redirect,'https://accounts.example/?verify=1');}}
 finally{await app.close();}
});

 test('browsing pages cannot access privileged account storage or session details',async()=>{
 const app=await server(async()=>Response.json({uid:'fr_00000000-0000-4000-8000-000000000001',fid:'00000000-0000-4000-8000-000000000002',epoch:1,expires:Math.floor(Date.now()/1000)+900}));
 try{for(const path of ['/api/account/session','/api/account/vault','/api/account/preferences'])assert.equal((await fetch(app.origin+path)).status,404);
 const r=await fetch(app.origin+'/api/account/status',{headers:{cookie:'__Host-frost-browse='+token()}});assert.deepEqual(await r.json(),{allowed:true});}finally{await app.close();}
 });

test('required username change redirects to the dispenser without forcing email reverification',async()=>{
 const app=await server(async()=>Response.json({code:'USERNAME_CHANGE_REQUIRED',error:'Change your username.'},{status:403}));
 try{const response=await fetch(app.origin+'/api/account/status',{headers:{cookie:'__Host-frost-browse='+token()}});assert.equal(response.status,403);assert.equal((await response.json()).redirect,'https://accounts.example/');}finally{await app.close();}
});

test('history endpoint requires POST, same origin, JSON and bounded bodies before forwarding',async()=>{
 const calls=[],app=await server(async(url,request)=>{calls.push({url,body:JSON.parse(request.body)});return Response.json(url.endsWith('/internal/history')?{ok:true}:{uid:'fr_00000000-0000-4000-8000-000000000001',fid:'00000000-0000-4000-8000-000000000002',epoch:1,expires:Math.floor(Date.now()/1000)+900});});
 const headers={origin:'https://frost.example','content-type':'application/json',cookie:'__Host-frost-browse='+token()};
 try{
  const url=app.origin+'/api/account/history';assert.equal((await fetch(url)).status,405);
  assert.equal((await fetch(url,{method:'POST',headers:{...headers,origin:'https://evil.example'},body:'{}'})).status,403);
  assert.equal((await fetch(url,{method:'POST',headers,body:'{'})).status,400);
  assert.equal((await fetch(url,{method:'POST',headers,body:'x'.repeat(9000)})).status,413);
  assert.equal(calls.length,0);
  const visit={url:'https://example.com/',title:'Synthetic'};assert.equal((await fetch(url,{method:'POST',headers,body:JSON.stringify(visit)})).status,200);
  assert.equal(calls[1].url,'https://accounts.example/internal/history');assert.deepEqual(calls[1].body.visit,visit);assert.equal(calls[1].body.origin,'https://frost.example');
 }finally{await app.close();}
});
