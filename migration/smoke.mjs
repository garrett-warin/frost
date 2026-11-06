import assert from 'node:assert/strict';
const role=process.env.FROST_SERVICE;
const headers={'x-frost-origin-key':process.env.ORIGIN_KEY,'x-frost-public-host':process.env.PUBLIC_HOSTS.split(',')[0]};
for(const path of ['/','/'+(role==='admin'?'admin.js':'account.mjs')]){
  const response=await fetch('http://127.0.0.1:8080'+path,{headers});
  assert.equal(response.status,200,role+' '+path);await response.arrayBuffer();
}
assert.equal((await fetch('http://127.0.0.1:8080/')).status,403);
assert.equal((await fetch('http://127.0.0.1:9001/invoke',{method:'POST',body:'{}'})).status,403);
const {invokeBridge}=await import('./bridge.mjs');
const result=role==='accounts'?await invokeBridge({path:'/announcement',body:{}}):await invokeBridge({action:'dashboard',body:{range:'day',timezone:'America/New_York'}});
assert.equal(result.statusCode,200,'private service bridge');
console.log(role+': static pages, origin rejection, private bridge rejection and authenticated bridge passed');
