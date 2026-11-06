import {initializeDatabase,pool,transaction} from './postgres.mjs';
import {publicServer,privateServer} from './http-adapter.mjs';
const role=process.env.FROST_SERVICE;
if(!['accounts','admin'].includes(role))throw Error('Invalid service role');
await initializeDatabase();
const {handler}=await import('./'+role+'.mjs');
publicServer({handler,originKey:process.env.ORIGIN_KEY,allowedHosts:(process.env.PUBLIC_HOSTS||'').split(',').filter(Boolean)}).listen(8080,'0.0.0.0');
privateServer({handler,bridgeKey:process.env.BRIDGE_KEY,role}).listen(9001,'0.0.0.0');
console.log(role+' ready');
if(role==='accounts'&&process.env.FROST_JOBS_ENABLED==='true') {
  let supportBusy=false;
  setInterval(async()=>{if(supportBusy)return;supportBusy=true;try{const result=await handler({source:'frost.support-ai'});if(result?.statusCode>=400)throw Error('Support task failed');}catch{console.error('Support AI task failed');}finally{supportBusy=false;}},5000).unref();
  let busy=false,ticks=0;
  setInterval(async()=>{
    if(busy)return;busy=true;
    try {
      const sample=await handler({source:'frost.admin',action:'sample',body:{}});
      if(sample?.statusCode>=400)throw Error('Sampling failed');
      if(++ticks%5===0){const monitor=await handler({source:'aws.events','detail-type':'Scheduled Event'});if(monitor?.statusCode>=400)throw Error('Monitor failed');}
      if(ticks%60===0)for(const namespace of ['accounts','admin'])await transaction(namespace,db=>db.query('DELETE FROM frost_records WHERE namespace=$1 AND expires IS NOT NULL AND expires<$2',[namespace,Math.floor(Date.now()/1000)]));
    }catch{console.error('Scheduled Frost task failed');}finally{busy=false;}
  },60000).unref();
}
process.on('SIGTERM',async()=>{await pool.end();process.exit(0);});
