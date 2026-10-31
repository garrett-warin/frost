import test from 'node:test';
import assert from 'node:assert/strict';
import {createAnalytics} from '../platform/analytics.mjs';
import {dispatchOwner} from '../platform/owner.mjs';
import {memoryStore} from './helpers/platform-store.mjs';
import {atomic} from '../platform/store.mjs';
const start=Date.UTC(2026,9,26)/1000;
test('analytics distinguishes missing/zero, UTC day/week, retention and account filters',async()=>{
 const store=memoryStore();let time=start+120,online=0;
 const analytics=createAnalytics({store,now:()=>time},{fetcher:async()=>({ok:online!==null,json:async()=>({online})})});
 await atomic(store,async tx=>{for(const [i,status,createdAt] of [[1,'active',start-86400],[2,'banned',start+60],[3,'suspended',start-8*86400]])await tx.put('user:'+i,{kind:'users',sort:String(i),uid:String(i),username:'snow'+i,email:'snow'+i+'@example.test',status,createdAt,epoch:99,devices:['private']});await tx.put('ticket:1',{kind:'tickets',sort:'1',status:'open'});});
 assert.equal((await analytics.dashboard()).online,null);
 await analytics.sample();let result=await analytics.dashboard();assert.equal(result.online,0);assert.equal(result.todayPeak,0);assert.equal(result.registered,1);assert.equal(result.accounts,3);assert.equal(result.banned,1);assert.equal(result.openTickets,1);assert.equal(result.series[0].online,0);
 time+=60;online=7;await analytics.sample();time+=60;online=null;await analytics.sample();result=await analytics.dashboard('week');assert.equal(result.online,null);assert.equal(result.todayPeak,7);assert.equal(result.registered,2);assert.equal(result.series.length,7);assert.equal(result.series[0].online,null);
 const stored=await store.get('online-hour:'+start);assert.equal(stored.expires,start+32*86400);assert.equal(Object.keys(stored.samples).length,3);
 const page=await analytics.listUsers({query:'SNOW2',status:'banned'});assert.equal(page.total,1);assert.equal(page.items[0].epoch,undefined);assert.equal(page.items[0].devices,undefined);assert.equal((await analytics.listUsers({status:'active'})).total,1);
 await assert.rejects(analytics.dashboard('month'));await assert.rejects(analytics.listUsers({offset:-1}));
 time=start+86400+60;result=await analytics.dashboard();assert.equal(result.todayPeak,null);assert.equal(result.registered,0);assert.equal(result.online,null);
});
test('owner dispatcher only handles direct IAM events, never HTTP events or unknown operations',async()=>{
 let calls=0;const service={control:{admin:async(action,body)=>{calls++;return {action,body}}}},analytics={sample:async()=>({online:0}),dashboard:async()=>({accounts:3}),listUsers:async()=>({items:[]})};
 assert.equal(await dispatchOwner({source:'frost.admin',requestContext:{http:{method:'POST'}},action:'user'},service,analytics),null);assert.equal(calls,0);
 assert.equal(await dispatchOwner({source:'anything',action:'user'},service,analytics),null);
 assert.equal((await dispatchOwner({source:'frost.admin',action:'user',body:{uid:'test'}},service,analytics)).statusCode,200);assert.equal(calls,1);
 assert.equal((await dispatchOwner({source:'frost.admin',action:'unknown'},service,analytics)).statusCode,400);
});
