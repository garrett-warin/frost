import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createFrostServer} from '../server.mjs';

test('main-site admin entry redirects only to the isolated console without forwarding input',async()=>{
 const app=createFrostServer({adminOrigin:'https://dadmin.cloudfront.net'}).listen(0,'127.0.0.1');await once(app,'listening');
 const origin=`http://localhost:${app.address().port}`;
 try {
  for(const path of ['/admin','/admin/','/admin?next=https://attacker.example&setup=do-not-forward']){
   const response=await fetch(origin+path,{redirect:'manual'});
   assert.equal(response.status,303);assert.equal(response.headers.get('location'),'https://dadmin.cloudfront.net/#');
   assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('referrer-policy'),'no-referrer');
   assert.equal(await response.text(),'');
  }
  assert.equal((await fetch(origin+'/admin',{method:'POST',redirect:'manual'})).status,405);
 }finally{app.closeAllConnections();await new Promise(resolve=>app.close(resolve));}
});

test('unconfigured admin entry fails closed',async()=>{
 const app=createFrostServer({adminOrigin:''}).listen(0,'127.0.0.1');await once(app,'listening');
 try{const response=await fetch(`http://localhost:${app.address().port}/admin`,{redirect:'manual'});assert.equal(response.status,503);assert.equal(response.headers.get('location'),null);}
 finally{app.closeAllConnections();await new Promise(resolve=>app.close(resolve));}
});
