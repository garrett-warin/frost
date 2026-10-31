import test from 'node:test';
import assert from 'node:assert/strict';
import {outageMessage,startOutageMonitor} from '../public/outage-banner.mjs';
const report=(...states)=>({checkedAt:100000,servers:states.map(status=>({status}))});
test('healthy, degraded, fallback, total failure and stale results are distinguished',()=>{
 assert.equal(outageMessage(report('healthy','healthy'),100000),'');
 assert.match(outageMessage(report('unreachable','healthy'),100000),/healthy server/);
 assert.match(outageMessage(report('healthy','unavailable'),100000),/^Outage:/);
 assert.match(outageMessage(report('healthy','unknown'),100000),/^Server warning:/);
 assert.doesNotMatch(outageMessage(report('unreachable','unavailable'),100000),/healthy server/);
 assert.equal(outageMessage(report('healthy','healthy'),160001),null);
 assert.equal(outageMessage(report('healthy','healthy'),90000),null);
 assert.equal(outageMessage(report('healthy','bogus'),100000),null);
 assert.equal(outageMessage(null,100000),null);
});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('monitor displays outage, clears recovery, distinguishes fetch failure, pauses and cleans up',async()=>{
 const banner={hidden:true},message={textContent:''};
 let next=report('healthy','unavailable'),run,listener,calls=0;
 const doc={hidden:false,addEventListener:(_,fn)=>listener=fn,removeEventListener:()=>listener=null};
 const stop=startOutageMonitor({banner,message,doc,now:()=>100000,cancel:()=>{},schedule:fn=>{run=fn;return 1;},
 fetchHealth:async()=>{calls++;if(next===null)throw Error('offline');return {ok:true,json:async()=>next};}});
 await tick();assert.equal(banner.hidden,false);assert.match(message.textContent,/^Outage:/);
 next=report('healthy','healthy');await run();assert.equal(banner.hidden,true);
 next=null;await run();assert.equal(banner.hidden,true);await run();assert.match(message.textContent,/^Connection warning:/);
 doc.hidden=true;const prior=calls;await run();assert.equal(calls,prior);
 doc.hidden=false;next=report('healthy','healthy');listener();await tick();assert.equal(banner.hidden,true);
 stop();assert.equal(listener,null);await run();assert.equal(calls,prior+1);
});
test('overlapping requests and stopped late responses cannot change UI',async()=>{
 let resolve,listener,calls=0;const banner={hidden:true},message={textContent:''};
 const doc={hidden:false,addEventListener:(_,fn)=>listener=fn,removeEventListener:()=>{}};
 const stop=startOutageMonitor({banner,message,doc,now:()=>100000,cancel:()=>{},schedule:()=>1,
 fetchHealth:()=>{calls++;return new Promise(r=>resolve=r);}});
 listener();assert.equal(calls,1);stop();
 resolve({ok:true,json:async()=>report('healthy','unavailable')});
 await tick();assert.equal(banner.hidden,true);
});
