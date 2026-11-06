import {effectiveUser} from './restrictions.mjs';
import {analyticsDays} from './analytics-time.mjs';
import {isOnline,onlineAdmins} from './online.mjs';
import {atomic} from './store.mjs';
import {requireThat} from './security.mjs';
const hour=3600,day=86400;
export function createAnalytics(accounts,{fetcher=fetch}={}){
 const {store,now}=accounts;
 async function all(kind){const items=[];let cursor;do{const page=await store.list(kind,{cursor,limit:100});items.push(...page.items);cursor=page.cursor;requireThat(items.length<=10000&&!((items.length===10000)&&cursor),503,'This collection is too large to summarize.');}while(cursor);return items;}
 async function sample(){
  let online=null;try{const response=await fetcher('https://frost-browsing.fly.dev/api/presence',{signal:AbortSignal.timeout(5000),redirect:'error'});if(response.ok){const value=await response.json();if(Number.isInteger(value.online)&&value.online>=0&&value.online<=10000)online=value.online;}}catch{}
  const at=now(),bucket=Math.floor(at/hour)*hour,minute=Math.floor((at-bucket)/60);
  await atomic(store,async tx=>{const key='online-hour:'+bucket,old=await tx.get(key),samples=old?.samples||{};samples[minute]={at,online};await tx.put(key,{samples,bucket,expires:bucket+32*day});});
  return {online,at};
 }
 async function dashboard(range='day',timezone='UTC'){
  requireThat(['day','week'].includes(range),400,'Choose day or week.');
  const at=now(),calendar=analyticsDays(at,timezone),today=calendar.starts[6],start=range==='week'?calendar.starts[0]:today;
  const users=(await all('users')).map(u=>effectiveUser(u,now())),tickets=await all('tickets');
  const buckets=[];for(let b=Math.floor(start/hour)*hour;b<=at;b+=hour)buckets.push(b);
  const rows=[];for(let i=0;i<buckets.length;i+=12)rows.push(...await Promise.all(buckets.slice(i,i+12).map(b=>store.get('online-hour:'+b))));
  const samples=rows.flatMap(row=>Object.values(row?.samples||{})).filter(s=>s.at>=start&&s.at<=at).sort((a,b)=>a.at-b.at);
  const latest=samples.at(-1),todaySamples=samples.filter(s=>s.at>=today&&s.online!==null);
  const boundaries=range==='week'?calendar.starts:[];if(range==='day'){for(let b=today;b<=at;b+=hour)boundaries.push(b);boundaries.push(at+1);}const series=[];
  for(let i=0;i<boundaries.length-1;i++){const b=boundaries[i],end=boundaries[i+1];if(b>at||b===end)continue;const observed=samples.filter(s=>s.at>=b&&s.at<end&&s.online!==null);series.push({at:b,online:observed.length?Math.max(...observed.map(s=>s.online)):null,registered:users.filter(u=>u.createdAt>=b&&u.createdAt<end&&u.createdAt<=at).length});}
  return {adminsOnline:await onlineAdmins(store,at),at,range,timezone:calendar.timezone,online:latest&&at-latest.at<180?latest.online:null,lastSampleAt:latest?.at||null,todayPeak:todaySamples.length?Math.max(...todaySamples.map(s=>s.online)):null,accounts:users.length,banned:users.filter(u=>u.status==='banned').length,suspended:users.filter(u=>u.status==='suspended').length,registered:users.filter(u=>u.createdAt>=start&&u.createdAt<=at).length,openTickets:tickets.filter(t=>t.status==='open').length,series};
 }
 async function listUsers(body){const query=String(body.query||'').toLowerCase().slice(0,254);requireThat(['all','online','active','banned','suspended'].includes(body.status||'all'),400,'Invalid status.');const users=(await all('users')).map(u=>effectiveUser(u,now())).filter(u=>(!query||[u.uid,u.username,u.email].some(v=>v?.toLowerCase().includes(query)))&&(!body.status||body.status==='all'||(body.status==='online'?isOnline(u,now()):u.status===body.status)));const offset=Number(body.offset||0);requireThat(Number.isSafeInteger(offset)&&offset>=0,400,'Invalid page.');return {total:users.length,items:users.slice(offset,offset+50).map(u=>({uid:u.uid,username:u.username,email:u.email,status:u.status,createdAt:u.createdAt,restrictionReason:u.restrictionReason,restrictionUntil:u.restrictionUntil||null,usernameChangeRequired:!!u.usernameChangeRequired,online:isOnline(u,now()),lastSeenAt:u.browserSeenAt||null})),next:offset+50<users.length?offset+50:null};}
 return {sample,dashboard,listUsers};
}
