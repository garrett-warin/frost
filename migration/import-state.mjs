import {readFile} from 'node:fs/promises';
import {initializeDatabase,pool,transaction} from './postgres.mjs';
                                                                      
const [role,path]=process.argv.slice(2);
if(!['accounts','admin'].includes(role)||!path)throw Error('Expected accounts/admin and an export file');
const decode=value=>Object.hasOwn(value,'S')?value.S:Object.hasOwn(value,'N')?Number(value.N):Object.hasOwn(value,'BOOL')?value.BOOL:Object.hasOwn(value,'NULL')?null:undefined;
const rows=(await readFile(path,'utf8')).trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
await initializeDatabase();
await transaction(role,async db=>{
  const count=await db.query('SELECT count(*)::int AS n FROM frost_records WHERE namespace=$1',[role]);
  if(count.rows[0].n!==0)throw Error('Import requires an empty namespace');
  for(const item of rows) {
    const id=item.id?.S;if(!id)throw Error('Missing row identity');
    const payload=role==='accounts'?JSON.parse(item.payload.S):Object.fromEntries(Object.entries(item).filter(([k])=>k!=='id').map(([k,v])=>{const value=decode(v);if(value===undefined)throw Error('Unsupported admin attribute');return [k,value];}));
    await db.query('INSERT INTO frost_records(namespace,id,version,payload,kind,sort,expires) VALUES($1,$2,$3,$4,$5,$6,$7)',[role,id,role==='accounts'?Number(item.v.N):1,payload,item.kind?.S||'internal',item.sort?.S||id,item.expires?.N||null]);
  }
});
const count=(await pool.query('SELECT count(*)::int AS n FROM frost_records WHERE namespace=$1',[role])).rows[0].n;
if(count!==rows.length)throw Error('Import count mismatch');
console.log(role+': imported '+count+' rows into isolated store');
await pool.end();
