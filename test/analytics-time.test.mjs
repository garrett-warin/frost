import test from 'node:test';import assert from 'node:assert/strict';import {analyticsDays} from '../platform/analytics-time.mjs';import {createAnalytics} from '../platform/analytics.mjs';import {memoryStore} from './helpers/platform-store.mjs';import {atomic} from '../platform/store.mjs';
const seconds=s=>Date.parse(s)/1000;
test('local day boundaries handle DST and fractional offsets',()=>{
 const spring=analyticsDays(seconds('2026-03-08T16:00:00Z'),'America/New_York');assert.equal(spring.starts[7]-spring.starts[6],23*3600);assert.equal(spring.starts[6],seconds('2026-03-08T05:00:00Z'));
 const fall=analyticsDays(seconds('2026-11-01T16:00:00Z'),'America/New_York');assert.equal(fall.starts[7]-fall.starts[6],25*3600);
 const nepal=analyticsDays(seconds('2026-10-27T12:00:00Z'),'Asia/Kathmandu');assert.equal(nepal.starts[6],seconds('2026-10-26T18:15:00Z'));
 assert.throws(()=>analyticsDays(1000,'invalid/timezone'),/Invalid timezone/);
});
test('viewer timezone changes daily peak and registrations, retaining partial UTC storage bucket',async()=>{
 const store=memoryStore(),at=seconds('2026-10-27T02:00:00Z'),analytics=createAnalytics({store,now:()=>at});
 await atomic(store,async tx=>{await tx.put('user:x',{kind:'users',sort:'x',uid:'x',status:'active',createdAt:seconds('2026-10-26T23:00:00Z')});for(const [date,online] of [['2026-10-26T23:00:00Z',9],['2026-10-27T01:00:00Z',2]]){const t=seconds(date);await tx.put('online-hour:'+t,{samples:{0:{at:t,online}}});}});
 const utc=await analytics.dashboard('day','UTC'),ny=await analytics.dashboard('day','America/New_York');assert.equal(utc.registered,0);assert.equal(ny.registered,1);assert.equal(utc.todayPeak,2);assert.equal(ny.todayPeak,9);assert.equal(ny.timezone,'America/New_York');
 const t=seconds('2026-10-26T18:20:00Z');await atomic(store,async tx=>tx.put('online-hour:'+seconds('2026-10-26T18:00:00Z'),{samples:{20:{at:t,online:17}}}));assert.equal((await analytics.dashboard('day','Asia/Kathmandu')).todayPeak,17);
});
