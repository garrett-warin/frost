import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createFrostServer,createServerHealth} from '../server.mjs';

test('health probes target both machines, coalesce callers and expire cached results',async()=>{
 let time=100000,calls=0;
 const health=createServerHealth({origin:'https://frost-browsing.fly.dev',machineId:'683e3d9ae17238',now:()=>time,fetchHealth:async(url,options)=>{
  calls++;assert.equal(url.href,'https://frost-browsing.fly.dev/health');assert.equal(options.redirect,'error');assert.ok(options.signal);
  return {ok:true,json:async()=>({ok:true,machine:options.headers['Fly-Force-Instance-Id']})};
 }});
 const [a,b]=await Promise.all([health(),health()]);assert.equal(calls,2);assert.deepEqual(a,b);
 assert.deepEqual(a.servers.map(s=>s.status),['healthy','healthy']);
 await health();assert.equal(calls,2);time+=15001;await health();assert.equal(calls,4);
});

test('fallback responses, failures and local development never report false health',async()=>{
 for(const [kind,expected] of [['fallback','unknown'],['error','unreachable'],['bad','unavailable']]){
  const health=createServerHealth({origin:'https://frost-browsing.fly.dev',machineId:'683e3d9ae17238',fetchHealth:async(url,options)=>{
   if(kind==='error')throw Error('Timeout');
   return {ok:kind!=='bad',json:async()=>({ok:true,machine:kind==='fallback'?'different':options.headers['Fly-Force-Instance-Id']})};
  }});
  assert.deepEqual((await health()).servers.map(s=>s.status),[expected,expected]);
 }
 const local=createServerHealth({machineId:'local',fetchHealth:()=>{throw Error('Must not fetch');}});
 assert.deepEqual((await local()).servers.map(s=>s.status),['unknown','unknown']);
});

test('health routes identify the responding machine and report uncached local status',async()=>{
 const app=createFrostServer({machineId:'local',publicOrigin:undefined,dispenserOrigin:'',adminOrigin:''}).listen(0,'127.0.0.1');
 await once(app,'listening');const base='http://localhost:'+app.address().port;
 try{
  assert.deepEqual(await (await fetch(base+'/health')).json(),{ok:true,service:'frost',machine:'local'});
  const response=await fetch(base+'/api/server-health');assert.equal(response.headers.get('cache-control'),'no-store');
  assert.deepEqual((await response.json()).servers.map(s=>s.status),['unknown','unknown']);
  assert.equal(await (await fetch(base+'/api/server-health',{method:'HEAD'})).text(),'');
 }finally{app.closeAllConnections();await new Promise(resolve=>app.close(resolve));}
});

test('OVH single-server topology does not probe retired Fly machines',async()=>{
 const health=createServerHealth({machineId:'ovh-bhs-1',now:()=>123,fetchHealth:async()=>{throw Error('Must not probe Fly');}});
 assert.deepEqual(await health(),{checkedAt:123,topology:'single',servers:[{name:'Canada - Beauharnois',status:'healthy'}]});
});
