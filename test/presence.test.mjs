import test from 'node:test';
import assert from 'node:assert/strict';
import {createPresence} from '../presence.mjs';
test('presence deduplicates, expires, bounds memory and rejects malformed IDs',()=>{
 let time=0; const count=createPresence({now:()=>time,ttl:75,limit:2});
 const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',c='33333333-3333-4333-8333-333333333333';
 assert.equal(count(a),1); assert.equal(count(a),1); assert.equal(count(b),2);
 assert.throws(()=>count(c)); assert.throws(()=>count('<script>'));
 time=74; assert.equal(count(a),2); time=75; assert.equal(count(null),1);
 time=150; assert.equal(count(null),0); assert.equal(count(c),1);
});

import {once} from 'node:events';
import {createFrostServer} from '../server.mjs';
test('presence API reports activity and rejects invalid IDs without counting HEAD',async()=>{
 const app=createFrostServer({machineId:'local',presenceMachine:''}).listen(0,'127.0.0.1');
 await once(app,'listening'); const base='http://localhost:'+app.address().port+'/api/presence';
 try {
  assert.equal((await (await fetch(base)).json()).online,0);
  assert.equal((await fetch(base+'?id=bad')).status,400);
  const a='11111111-1111-4111-8111-111111111111';
  await fetch(base+'?id='+a,{method:'HEAD'});
  assert.equal((await (await fetch(base)).json()).online,0);
  assert.deepEqual(await (await fetch(base+'?id='+a)).json(),{online:1,server:'Local',machine:'local'});
  assert.equal((await (await fetch(base+'?id='+a)).json()).online,1);
 } finally {app.closeAllConnections();await new Promise(resolve=>app.close(resolve));}
});
