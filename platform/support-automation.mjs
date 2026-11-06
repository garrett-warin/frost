import {randomUUID} from 'node:crypto';
import {atomic} from './store.mjs';
import {effectiveUser} from './restrictions.mjs';

export const appealInstruction='An administrator will review your appeal. Write at least two sentences explaining why you were banned and whether you will do it again. You can add those details here. AI cannot decide appeals or remove restrictions.';
export const asksHuman=text=>/\b(human|real person|administrator|speak to (?:an? )?admin|talk to (?:an? )?admin)\b/i.test(text);
export const isAppeal=(row,user)=>row.type==='appeal'||['banned','suspended'].includes(user?.status)||/\b(appeal|unban|banned|suspended|suspension)\b/i.test(row.subject+' '+row.message+' '+(row.replies||[]).filter(r=>r.sender==='user').map(r=>r.message).join(' '));
export function publicSupport(row){
 const {adminUnread,needsAssistance,assistanceRequestedBy,assistanceRequestedAt,assistingAdmin,claimedBy,claimedUsername,claimedAt,handoffSummary,handoffReason,summarySource,summaryAt,appealRecommendation,appealRationale,aiRevision,summaryPending,...safe}=row;
 return {...safe,replies:(row.replies||[]).map(r=>({sender:['user','ai','system'].includes(r.sender)?r.sender:'admin',actor:r.sender==='user'?'You':r.sender==='ai'?'Grove AI':r.sender==='system'?'Support':'Administrator',message:r.message,at:r.at}))};
}
export async function saveSupport(tx,row){await tx.put('ticket:'+row.id,row);await tx.put('user-ticket:'+row.id,{...publicSupport(row),kind:'tickets:'+row.uid});}
function fallbackSummary(row){return ('Subject: '+row.subject+'\nUser reported: '+row.message+'\nRecent conversation:\n'+(row.replies||[]).slice(-6).map(r=>(r.sender==='user'?'User':r.sender==='ai'?'Grove AI':'Support')+': '+r.message).join('\n')).slice(0,2000);}
export async function queueSupport(tx,row,mode,at){
 row.aiRevision=(row.aiRevision||0)+1;row.aiPending=mode==='reply';row.summaryPending=mode==='summary';
 await tx.put('support-ai-job:'+row.id,{kind:'support-ai-jobs',sort:at+':'+row.id,id:row.id,revision:row.aiRevision,mode,expires:row.expires});
}
export async function humanSupport(tx,row,reason,at,{appeal=false,provider=false}={}){
 row.supportMode='human';row.adminUnread=true;row.handoffReason=reason;row.handoffSummary=fallbackSummary(row);row.summarySource='conversation excerpt';row.summaryAt=at;
 row.aiPending=false;row.aiRevision=(row.aiRevision||0)+1;row.summaryPending=false;
 if(appeal){row.type='appeal';row.appealRecommendation='review_deeper';row.appealRationale='AI review is pending or unavailable. An administrator should review the appeal and evidence.';}
 const message=appeal?appealInstruction:'Your request is in the human support queue. An administrator can pick it up here.';
 if(row.replies.length<100&&!row.replies.some(r=>r.sender==='system'&&r.message===message)){
  row.replies.push({sender:'system',message,at});row.userUnread=true;row.noticeRevision=row.replies.length;
 }
 if(provider)await queueSupport(tx,row,'summary',at);else await tx.remove('support-ai-job:'+row.id);
}
export function createSupportAutomation(accounts,provider){
 const {store,now,rate}=accounts;
 async function process(id){
  const lease=randomUUID();let snapshot;
  try{snapshot=await atomic(store,async tx=>{
   const job=await tx.get('support-ai-job:'+id),row=await tx.get('ticket:'+id);
   if(!job)return null;
   if(!row||row.status!=='open'||row.expires<=now()||row.aiRevision!==job.revision){await tx.remove('support-ai-job:'+id);return null;}
   if(job.leaseUntil>now())return null;
   const user=effectiveUser(await tx.get('user:'+row.uid),now());
   if(!user||user.status==='deleted'){await tx.remove('support-ai-job:'+id);return null;}
   if(job.mode==='reply'&&(row.supportMode!=='ai'||row.claimedBy)){await tx.remove('support-ai-job:'+id);return null;}
   if(job.mode==='reply'&&isAppeal(row,user)){await humanSupport(tx,row,'Appeal requires an administrator',now(),{appeal:true,provider:!!provider});await saveSupport(tx,row);return null;}
   await rate(tx,'support-ai-global',30,60);await rate(tx,'support-ai-user:'+row.uid,6,60);
   await tx.put('support-ai-job:'+id,{...job,lease,leaseUntil:now()+60});return {row,job};
  });}catch{return {deferred:true};}
  if(!snapshot)return {skipped:true};
  const {row,job}=snapshot;let result;
  try{if(!provider)throw Error('Unavailable');result=await provider({mode:job.mode,appeal:row.type==='appeal',subject:row.subject,messages:[{sender:row.initialSender==='admin'?'admin':'user',message:row.message},...row.replies]});}catch{result=null;}
  return atomic(store,async tx=>{
   const current=await tx.get('ticket:'+id),latest=await tx.get('support-ai-job:'+id),user=current&&effectiveUser(await tx.get('user:'+current.uid),now());
   if(!current||!latest||latest.lease!==lease||latest.revision!==job.revision||current.aiRevision!==job.revision)return {stale:true};
   if(current.status!=='open'||current.expires<=now()||!user||user.status==='deleted'){await tx.remove('support-ai-job:'+id);return {stale:true};}
   if(job.mode==='summary'){
    if(current.supportMode==='human'&&typeof result?.summary==='string'&&result.summary.trim()){current.handoffSummary=result.summary.slice(0,2000);current.summarySource='AI';current.summaryAt=now();}
    if(current.type==='appeal'){current.appealRecommendation=['accept','deny','review_deeper'].includes(result?.recommendation)?result.recommendation:'review_deeper';current.appealRationale=typeof result?.rationale==='string'&&result.rationale.trim()?result.rationale.slice(0,2000):'AI review was unavailable. An administrator should review the appeal and evidence.';}
    current.summaryPending=false;await tx.remove('support-ai-job:'+id);await saveSupport(tx,current);return {summarized:true};
   }
   if(current.supportMode!=='ai'||current.claimedBy){await tx.remove('support-ai-job:'+id);return {stale:true};}
   const appeal=isAppeal(current,user);
   if(appeal||!result||result.handoff===true||typeof result.message!=='string'||!result.message.trim()||current.replies.length>=98){
    await humanSupport(tx,current,appeal?'Appeal requires an administrator':!result?'AI unavailable':'AI requested human assistance',now(),{appeal,provider:!!provider&&!!result});
   }else{
    current.replies.push({sender:'ai',message:result.message.slice(0,2000),at:now()});current.aiPending=false;current.userUnread=true;current.noticeRevision=current.replies.length;current.updatedAt=now();await tx.remove('support-ai-job:'+id);
   }
   await saveSupport(tx,current);return {ok:true};
  });
 }
 async function tick(){const page=await store.list('support-ai-jobs',{limit:10});for(const job of page.items)await process(job.id);return {checked:page.items.length};}
 return {process,tick};
}
