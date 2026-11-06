import test from 'node:test';
import assert from 'node:assert/strict';
import {publicServer,privateServer} from './http-adapter.mjs';
const secret='synthetic-test-key-'.repeat(3);
async function run(server,fn){server.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));try{await fn('http://127.0.0.1:'+server.address().port);}finally{await new Promise(r=>server.close(r));}}
test('public caller cannot manufacture an owner event or bypass origin checks',async()=>{
  let received;
  await run(publicServer({originKey:secret,allowedHosts:['accounts.example'],handler:async event=>{received=event;return {statusCode:200,body:'ok',cookies:['one=1','two=2']};}}),async url=>{
    assert.equal((await fetch(url)).status,403);
    assert.equal((await fetch(url,{headers:{'x-frost-origin-key':secret,'x-frost-public-host':'evil.example'}})).status,403);
    const response=await fetch(url+'/api/test?a=1',{method:'POST',headers:{'x-frost-origin-key':secret,'x-frost-public-host':'accounts.example'},body:JSON.stringify({source:'frost.admin',action:'user',requestContext:null})});
    assert.equal(response.status,200);assert.equal(received.source,undefined);assert.equal(received.requestContext.http.method,'POST');assert.equal(received.rawQueryString,'a=1');assert.equal(received.headers['x-frost-origin-key'],undefined);assert.equal(response.headers.getSetCookie().length,2);
  });
});
test('private bridge requires its own key and constructs a fixed service identity',async()=>{
  let received;
  await run(privateServer({bridgeKey:secret,role:'accounts',handler:async event=>{received=event;return {statusCode:200,data:{ok:true}};}}),async url=>{
    assert.equal((await fetch(url+'/invoke',{method:'POST',body:'{}'})).status,403);
    const response=await fetch(url+'/invoke',{method:'POST',headers:{authorization:'Bearer '+secret},body:JSON.stringify({source:'aws.events',action:'dashboard',body:{},requestContext:{}})});
    assert.equal(response.status,200);assert.equal(received.source,'frost.admin');assert.equal(received.requestContext,undefined);
  });
});
