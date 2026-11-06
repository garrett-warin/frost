import {readFile,writeFile} from 'node:fs/promises';
import {transaction,pool} from './postgres.mjs';
const oldOrigin='https://d3mbml114oiqni.cloudfront.net',newOrigin='https://d3mwcpxtmhbydi.cloudfront.net';
const step=process.argv[2];
await transaction('accounts',async db=>{
 const row=(await db.query("SELECT * FROM frost_records WHERE namespace='accounts' AND id='deployment-config'")).rows[0];
 if(!row)throw Error('Missing deployment configuration');
 let value;
 if(step==='stage'){
  if(row.payload.origin!==oldOrigin)throw Error('Unexpected canonical dispenser');
  await writeFile('/backup/deployment-config.json',JSON.stringify(row.payload),{flag:'wx',mode:0o600});
  value={...row.payload,accountAliases:[newOrigin]};
 }else if(step==='activate'){
  if(row.payload.origin!==oldOrigin||!row.payload.accountAliases?.includes(newOrigin))throw Error('Alias not staged');
  value={...row.payload,origin:newOrigin,accountAliases:[oldOrigin]};
 }else if(step==='restore')value=JSON.parse(await readFile('/backup/deployment-config.json','utf8'));
 else throw Error('Choose stage, activate or restore');
 await db.query("UPDATE frost_records SET payload=$1,version=version+1 WHERE namespace='accounts' AND id='deployment-config'",[value]);
});
await pool.end();console.log('Dispenser configuration '+step+' completed');
