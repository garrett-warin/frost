import {randomUUID} from 'node:crypto';
import {atomic} from './store.mjs';
import {requireThat} from './security.mjs';

export const historyLimit=100, historyRetention=30*86400;
export function cleanVisit(value){
 requireThat(value&&typeof value.url==='string'&&value.url.length<=4096&&typeof value.title==='string'&&value.title.length<=300,400,'Invalid visit.');
 let url;try{url=new URL(value.url);}catch{}
 requireThat(url&&['http:','https:'].includes(url.protocol),400,'Invalid visit URL.');
 url.username='';url.password='';url.search='';url.hash='';
 requireThat(url.href.length<=2048,400,'Visit URL is too long.');
 return {url:url.href,title:value.title.replace(/[\u0000-\u001f\u007f]/g,'').trim()};
}
export function createBrowsingHistory(accounts){
 const {store,now}=accounts;
 const visible=row=>(row?.items||[]).filter(item=>item.recordedAt>now()-historyRetention).slice(0,historyLimit);
 async function record(access,origin,value){
  const visit=cleanVisit(value);
  return atomic(store,async tx=>{
   const {user}=await accounts.authorize(tx,access,{scope:'browse',origin});
   const assignment=await tx.get('assignment:'+user.uid);
   requireThat(!accounts.config.assignedOnly||assignment?.origin===origin,403,'Browsing assignment changed.');
   await accounts.rate(tx,'history:'+user.uid,60,60);
   const key='browsing-history:'+user.uid,items=visible(await tx.get(key));
   if(items[0]?.url===visit.url&&now()-items[0].recordedAt<3)return {ok:true};
   items.unshift({...visit,recordedAt:now()});
   await tx.put(key,{uid:user.uid,items:items.slice(0,historyLimit),expires:now()+historyRetention});
   return {ok:true};
  });
 }
 // Call only after staff authorization or the existing IAM owner dispatcher.
 async function read(body,actor='totp-owner'){
  requireThat(typeof body.uid==='string'&&/^fr_[a-f0-9-]{36}$/.test(body.uid),400,'Choose an account.');
  return atomic(store,async tx=>{
   const user=await tx.get('user:'+body.uid);requireThat(user&&user.status!=='deleted',404,'Account not found.');
   const row=await tx.get('browsing-history:'+body.uid),items=visible(row),id=randomUUID();
   if(row&&items.length!==row.items.length){if(items.length)await tx.put('browsing-history:'+body.uid,{...row,items});else await tx.remove('browsing-history:'+body.uid);}
   await tx.put('audit:'+id,{kind:'audit',sort:now()+':'+id,id,actor,action:'history:view',target:body.uid,reason:'Viewed browsing history',at:now(),expires:now()+365*86400});
   return {items,limit:historyLimit,retentionDays:30};
  });
 }
 return {record,read};
}
