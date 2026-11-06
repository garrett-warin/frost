import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {initializeDatabase,accountStore,adminStore,pool} from './postgres.mjs';
class Conflict extends Error {}
const scope='test-'+crypto.randomUUID();
await initializeDatabase();
after(async()=>{await pool.query('DELETE FROM frost_records WHERE namespace LIKE $1',[scope+'%']);await pool.end();});
test('transaction is all-or-nothing and protects absent/read-only rows',async()=>{
  const store=accountStore(scope,Conflict);
  await store.commit([{id:'a',version:null,write:true,value:{kind:'user',sort:'1',name:'one'}}]);
  await assert.rejects(store.commit([{id:'a',version:null,write:false},{id:'b',version:null,write:true,value:{}}]),Conflict);
  assert.equal(await store.get('b'),null);
  const results=await Promise.allSettled([1,2].map(n=>store.commit([{id:'a',version:1,write:true,value:{name:n}}])));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await store.get('a'))._v,2);
  await assert.rejects(store.commit([{id:'a',version:1,write:false},{id:'b',version:null,write:true,value:{}}]),Conflict);
  assert.equal(await store.get('b'),null);
});
test('namespaces and cursor pagination preserve isolation',async()=>{
  const store=accountStore(scope+'-list',Conflict),other=accountStore(scope+'-other',Conflict);
  for(let i=0;i<5;i++)await store.commit([{id:String(i),version:null,write:true,value:{kind:'user',sort:'same',i}}]);
  assert.equal(await other.get('0'),null);
  let cursor,found=[]; do {const page=await store.list('user',{limit:2,cursor});found.push(...page.items.map(x=>x.i));cursor=page.cursor;}while(cursor);
  assert.deepEqual(found,[4,3,2,1,0]);
  await assert.rejects(store.list('other',{cursor:Buffer.from(JSON.stringify({kind:{S:'user'},sort:{S:'same'},id:{S:'0'}})).toString('base64url')}));
});
test('absent-key races and missing read assertions cannot overwrite concurrent state',async()=>{
  const store=accountStore(scope+'-races',Conflict);
  const results=await Promise.allSettled([1,2].map(n=>store.commit([{id:'unique',version:null,write:true,value:{n}}])));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  await assert.rejects(store.commit([{id:'unique',version:null,write:false},{id:'dependent',version:null,write:true,value:{}}]),Conflict);
  assert.equal(await store.get('dependent'),null);
});
test('admin enrollment, rate limits and TOTP consumption are atomic',async()=>{
  const store=adminStore(scope+'-admin');
  const created=await Promise.all([store.create('auth',{secret:'synthetic'}),store.create('auth',{secret:'other'})]);
  assert.equal(created.filter(Boolean).length,1);
  const attempts=await Promise.all(Array.from({length:12},()=>store.attempt(123)));
  assert.equal(attempts.filter(Boolean).length,5);
  const codes=await Promise.all(Array.from({length:8},()=>store.consume(100,true)));
  assert.equal(codes.filter(Boolean).length,1);
  assert.equal(await store.consume(99,false),false);
  assert.equal(await store.consume(101,false),true);
  assert.equal((await store.get('auth')).enrolled,true);
});
