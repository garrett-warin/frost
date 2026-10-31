import {Conflict} from '../../platform/store.mjs';
export function memoryStore(){
 const rows=new Map();
 return {
  rows,
  async get(id){return structuredClone(rows.get(id)||null);},
  async list(kind,{cursor,limit=50}={}){const all=[...rows.values()].filter(x=>x.kind===kind).sort((a,b)=>String(b.sort).localeCompare(String(a.sort)));const start=cursor?Number(cursor):0;return {items:structuredClone(all.slice(start,start+limit)),cursor:start+limit<all.length?String(start+limit):null};},
  async commit(ops){
   if(new Set(ops.map(o=>o.id)).size!==ops.length||ops.length>100)throw Error('Invalid transaction.');
   for(const op of ops)if((rows.get(op.id)?._v??null)!==op.version)throw new Conflict();
   for(const op of ops)if(op.write){if(op.value===null)rows.delete(op.id);else rows.set(op.id,{...structuredClone(op.value),_v:(op.version||0)+1});}
  }
 };
}
