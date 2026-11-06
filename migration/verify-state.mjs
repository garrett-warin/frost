import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {pool} from './postgres.mjs';
const [role,path]=process.argv.slice(2);
if(!['accounts','admin'].includes(role)||!path)throw Error('Expected namespace and export');
const decode=v=>v.S??(v.N!==undefined?Number(v.N):v.BOOL??null);
const expected=(await readFile(path,'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
const actual=new Map((await pool.query('SELECT * FROM frost_records WHERE namespace=$1',[role])).rows.map(r=>[r.id,r]));
let mismatches=actual.size===expected.length?0:1;
for(const item of expected){
  const r=actual.get(item.id.S);
  const payload=role==='accounts'?JSON.parse(item.payload.S):Object.fromEntries(Object.entries(item).filter(([k])=>k!=='id').map(([k,v])=>[k,decode(v)]));
  try {
    assert.ok(r);assert.deepEqual(r.payload,payload);
    assert.equal(Number(r.version),role==='accounts'?Number(item.v.N):1);
    assert.equal(r.kind,item.kind?.S||'internal');assert.equal(r.sort,item.sort?.S||item.id.S);
    assert.equal(r.expires===null?null:Number(r.expires),item.expires?.N?Number(item.expires.N):null);
  }catch{mismatches++;}
}
await pool.end();
if(mismatches)throw Error(`Integrity check failed: ${mismatches} mismatches (contents withheld)`);
console.log(`${role}: all ${expected.length} records match the export, including versions and encrypted payloads`);
