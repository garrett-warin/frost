                                                                                       
import {createHash,randomUUID} from 'node:crypto';
import {pool,transaction} from './postgres.mjs';
let input='';for await(const chunk of process.stdin)input+=chunk;
const manifest=JSON.parse(input),apply=process.argv.includes('--apply');
const origins=manifest.new.filter(x=>x.role==='browser').map(x=>'https://'+x.domain);
const origin='https://'+manifest.new.find(x=>x.role==='accounts').domain;
if(origins.length!==15||new Set(origins).size!==15)throw Error('Require 15 unique browser links');
const hash=x=>createHash('sha256').update(x).digest('hex');
for(const host of [...origins,origin])if(!/^https:\/\/[a-z0-9]+\.cloudfront\.net$/.test(host))throw Error('Invalid host');
                                                                         
for(const host of origins){const response=await fetch(host+'/health',{signal:AbortSignal.timeout(15000)});const body=await response.json();if(!response.ok||body.ok!==true||body.machine!=='ovh-bhs-1'||body.service!=='frost')throw Error('Unhealthy new link');}
const page=await fetch(origin+'/',{signal:AbortSignal.timeout(15000)});if(!page.ok)throw Error('New dispenser unavailable');
await transaction('accounts',async db=>{
 const config=(await db.query("SELECT payload FROM frost_records WHERE namespace='accounts' AND id='deployment-config'")).rows[0].payload;
 if(config.origin!=='https://d3mwcpxtmhbydi.cloudfront.net'||config.endpoints.length!==15||!config.accountAliases.includes(origin))throw Error('Unexpected/stale deployment configuration');
 const old=config.endpoints,mapping=new Map(old.map((host,i)=>[host,origins[i]]));
 if(old.some(x=>origins.includes(x)))throw Error('New and old pools overlap');
                                                                                      
 mapping.set('https://d2kiw7chjuxr1v.cloudfront.net',origins[14]);
 const assignments=(await db.query("SELECT id,payload FROM frost_records WHERE namespace='accounts' AND id LIKE 'assignment:%'")).rows;
 if(assignments.some(x=>x.id!=='assignment:'+x.payload.uid||!mapping.has(x.payload.origin)))throw Error('Unexpected assignment outside old pool');
 const counts=new Map(origins.map(x=>[x,0]));for(const row of assignments)counts.set(mapping.get(row.payload.origin),counts.get(mapping.get(row.payload.origin))+1);
 if([...counts.values()].reduce((a,b)=>a+b,0)!==assignments.length)throw Error('Assignment count mismatch');
 console.log(JSON.stringify({mode:apply?'apply':'dry-run',newDispenser:origin,newLinks:15,assignments:assignments.length}));
 if(!apply)return;
 await db.query('CREATE TABLE frost_link_rotation_backup_20261105 AS SELECT * FROM frost_records WHERE false');
 await db.query("INSERT INTO frost_link_rotation_backup_20261105 SELECT * FROM frost_records WHERE namespace='accounts' AND (id='deployment-config' OR id LIKE 'endpoint:%' OR id LIKE 'assignment:%' OR id LIKE 'link-job:%')");
 const now=Math.floor(Date.now()/1000);
 async function put(id,payload){await db.query(`INSERT INTO frost_records(namespace,id,version,payload,kind,sort,expires) VALUES('accounts',$1,1,$2,$3,$4,$5) ON CONFLICT(namespace,id) DO UPDATE SET version=frost_records.version+1,payload=EXCLUDED.payload,kind=EXCLUDED.kind,sort=EXCLUDED.sort,expires=EXCLUDED.expires`,[id,payload,payload.kind||'internal',payload.sort||id,payload.expires||null]);}
 for(const host of origins)await put('endpoint:'+hash(host),{kind:'endpoints',sort:host,origin:host,assignments:counts.get(host),observed:'operational',blocked:false,failures:0,successes:1,totalChecks:1,successfulChecks:1,lastChecked:now,capacity:0});
 for(const row of assignments){const next={...row.payload,origin:mapping.get(row.payload.origin),assignedAt:now};await put(row.id,next);
  const id=randomUUID();await put('assignment-history:'+id,{kind:'assignments:'+next.uid,sort:now+':'+id,id,...next,previousOrigin:row.payload.origin,reason:'Administrator replaced the browsing link pool',expires:now+365*86400});
  const notice=randomUUID();await put('notice:'+notice,{kind:'notices:'+next.uid,sort:now+':'+notice,id:notice,uid:next.uid,type:'account',message:'Your Frost link has changed. Open your new link from Your link.',createdAt:now,read:false,expires:now+30*86400});
 }
 for(const host of mapping.keys()){const id='endpoint:'+hash(host);const previous=(await db.query("SELECT payload FROM frost_records WHERE namespace='accounts' AND id=$1",[id])).rows[0]?.payload||{kind:'endpoints',sort:host,origin:host};await put(id,{...previous,assignments:0,blocked:true,override:'retired',blockReason:'Replaced by fresh link pool',blockedAt:now});await db.query("DELETE FROM frost_records WHERE namespace='accounts' AND id=$1",['link-job:'+hash(host)]);}
 await put('deployment-config',{...config,origin,accountAliases:[...new Set([config.origin,...config.accountAliases])].filter(x=>x!==origin),endpoints:origins});
 const id=randomUUID();await put('audit:'+id,{kind:'audit',sort:now+':'+id,id,actor:'owner-deployment',action:'links:rotate',target:'browsing-pool',reason:'Owner requested 15 fresh links and a new dispenser; prior pool retired',at:now,expires:now+365*86400});
 const remaining=(await db.query("SELECT count(*)::int AS count FROM frost_records WHERE namespace='accounts' AND id LIKE 'assignment:%' AND NOT (payload->>'origin'=ANY($1::text[]))",[origins])).rows[0].count;
 if(remaining)throw Error('Assignment migration incomplete');
});
await pool.end();
console.log(apply?'SWITCH COMMITTED':'DRY RUN PASSED; no data changed');
