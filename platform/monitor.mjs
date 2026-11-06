import {get} from 'node:https';
import {lookup} from 'node:dns';
import {randomUUID} from 'node:crypto';
import {isPublicAddress} from '../relay-policy.mjs';
import {atomic} from './store.mjs';
import {hash} from './security.mjs';

export function probeEndpoint(origin,{timeout=5000}={}){
 return new Promise(resolve=>{
  const start=Date.now();let finished=false;
  const finish=result=>{if(!finished){finished=true;clearTimeout(timer);resolve({...result,latency:Date.now()-start});}};
  const request=get(new URL('/health',origin),{agent:false,lookup:(hostname,options,callback)=>lookup(hostname,{...options,all:true},(error,addresses)=>{
   if(error)return callback(error);
   if(!addresses?.length||addresses.some(item=>!isPublicAddress(item.address)))return callback(Object.assign(new Error('Unsafe address'),{code:'UNSAFE_ADDRESS'}));
   if(options.all)callback(null,addresses);else callback(null,addresses[0].address,addresses[0].family);
  })},response=>{
   let data='';response.setEncoding('utf8');response.on('data',chunk=>{data+=chunk;if(data.length>2048){request.destroy();finish({ok:false,failure:'unexpected-response'});}});
   response.on('end',()=>{let valid=false;try{const body=JSON.parse(data);valid=body.ok===true&&body.service==='frost';}catch{}finish({ok:response.statusCode===200&&valid,failure:response.statusCode!==200?'http-error':valid?null:'unexpected-response'});});
   response.on('error',()=>finish({ok:false,failure:'connection'}));
  });
  const timer=setTimeout(()=>{request.destroy();finish({ok:false,failure:'timeout'});},timeout);
  request.on('error',error=>finish({ok:false,failure:['ENOTFOUND','EAI_AGAIN'].includes(error.code)?'dns':/CERT|TLS|SSL/.test(error.code||'')?'tls':'connection'}));
 });
}

export function createMonitor(accounts,control,{probe=probeEndpoint}={}){
 const {store,config,now}=accounts;
 async function record(origin,result){return atomic(store,async tx=>{
  const key='endpoint:'+hash(origin),old=await tx.get(key);if(!old)return;
  const failed=!result.ok,failures=failed?(old.failures||0)+1:0,successes=failed?0:(old.successes||0)+1;
  let observed=old.observed||'unavailable';
  if(failures>=config.failureThreshold)observed='unavailable';
  else if(failed||result.latency>config.slowThresholdMs)observed='degraded';
  else if(successes>=config.recoveryThreshold)observed='operational';
  const changed={...old,observed,failures,successes,lastChecked:now(),latency:result.latency,lastFailure:result.failure||null,totalChecks:(old.totalChecks||0)+1,successfulChecks:(old.successfulChecks||0)+(result.ok?1:0)};
  const checkId=randomUUID();await tx.put('health:'+checkId,{kind:'health',sort:now()+':'+checkId,id:checkId,origin,ok:result.ok,latency:result.latency,failure:result.failure||null,at:now(),expires:now()+30*86400});
  if(failures>=config.failureThreshold&&!old.incidentId){const id=randomUUID();changed.incidentId=id;await tx.put('incident:'+id,{kind:'incidents',sort:now()+':'+id,id,origin,startedAt:now(),status:'open',failure:result.failure||'health-check',expires:now()+180*86400});}
  if(observed==='operational'&&old.incidentId){const incident=await tx.get('incident:'+old.incidentId);if(incident)await tx.put('incident:'+old.incidentId,{...incident,status:'resolved',resolvedAt:now()});changed.incidentId=null;}
  await tx.put(key,changed);
 });}
 async function tick(){
                                                                               
  const acquired=await atomic(store,async tx=>{const lease=await tx.get('monitor-lease');if(lease?.expires>now())return false;await tx.put('monitor-lease',{expires:now()+config.monitorIntervalSeconds});return true;});
  if(!acquired)return {skipped:true};
  for(const origin of config.endpoints){const endpoint=await store.get('endpoint:'+hash(origin));if(!endpoint||endpoint.override==='retired')continue;await record(origin,await probe(origin,{timeout:config.probeTimeoutMs}));}
  await control.cleanup();
  const endpoints=await Promise.all(config.endpoints.map(origin=>store.get('endpoint:'+hash(origin))));
  return {checked:endpoints.filter(Boolean).length};
 }
 return {tick,record};
}
