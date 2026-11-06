import {publicSupport,saveSupport,queueSupport,humanSupport,isAppeal,asksHuman} from './support-automation.mjs';
import {effectiveUser} from './restrictions.mjs';
import {randomUUID} from 'node:crypto';
import {atomic} from './store.mjs';
import {hash,hmac,plain,requireThat,approvedOrigin} from './security.mjs';
export function createControl(accounts,{actor='totp-owner',authorizeTarget,authorizeActor}={}){
 const {store,config,now,authorize,authenticate,notice,security,rate}=accounts;
 const effective=e=>e?.blocked?'blocked':e?.override||e?.observed||'unavailable';
 const safeEndpoint=e=>e&&({origin:e.origin,status:effective(e),lastChecked:e.lastChecked||null,latency:e.latency??null});
 async function audit(tx,action,target,reason,auditActor=actor){const actorUser=auditActor==='totp-owner'?null:await tx.get('user:'+auditActor);const id=randomUUID();await tx.put('audit:'+id,{kind:'audit',sort:now()+':'+id,id,actor:auditActor,actorUsername:actorUser?.username||null,action,target,reason,at:now(),expires:now()+365*86400});}
 async function ownedList(access,kind,cursor){const {user}=await authenticate(access,{allowRestricted:true});const rows=await store.list(kind+':'+user.uid,{cursor});return {items:rows.items.filter(r=>!r.expires||r.expires>now()).map(({_v,kind,sort,uid,expires,...r})=>kind.startsWith('tickets:')?publicReplies(r):r),cursor:rows.cursor};}
 async function assignUser(tx,user,{destination,reason='Automatic assignment',replace=false}={}){
  const prior=await tx.get('assignment:'+user.uid);
  const endpoints=await Promise.all(config.endpoints.map(origin=>tx.get('endpoint:'+hash(origin))));
  const current=endpoints.find(e=>e?.origin===prior?.origin);
  if(!replace&&!destination&&prior&&current&&!current.blocked&&effective(current)!=='retired')return prior;
  const candidates=endpoints.filter(e=>e&&(!replace||e.origin!==prior?.origin)&&!e.blocked&&effective(e)==='operational'&&(!destination||e.origin===destination)&&(!e.capacity||(e.assignments||0)<e.capacity||prior?.origin===e.origin)).sort((a,b)=>(a.assignments||0)-(b.assignments||0)||a.origin.localeCompare(b.origin));
  const next=candidates[0];requireThat(next,503,'No link is available right now. Please check back shortly.');
  if(prior?.origin===next.origin)return prior;
  if(current)await tx.put('endpoint:'+hash(current.origin),{...current,assignments:Math.max(0,(current.assignments||0)-1)});
  await tx.put('endpoint:'+hash(next.origin),{...next,assignments:(next.assignments||0)+1});
  const value={uid:user.uid,origin:next.origin,assignedAt:now()};await tx.put('assignment:'+user.uid,value);
  const id=randomUUID();await tx.put('assignment-history:'+id,{kind:'assignments:'+user.uid,sort:now()+':'+id,id,...value,...(prior?{previousOrigin:prior.origin}:{}),reason,expires:now()+365*86400});
  if(prior)await notice(tx,user.uid,'account','Your Grove link has changed. Open your new link from Your link.');return value;
 }
 async function assignment(access){
  const {user}=await authenticate(access,{allowRestricted:true});
  if(user.status!=='active')return null;
  try{const row=await allocate(access);return {...safeEndpoint(await store.get('endpoint:'+hash(row.origin))),assignedAt:row.assignedAt,rotationAvailableAt:user.linkRotationAvailableAt||0};}catch(error){if(error.status===503)return null;throw error;}
 }
 async function allocate(access){return atomic(store,async tx=>{const {user}=await authorize(tx,access);return assignUser(tx,user);});}
 async function rotateLink(access,body){
  requireThat(body?.confirmed===true,400,'Confirm the link change first.');
  return atomic(store,async tx=>{
   const {user}=await authorize(tx,access);
   requireThat(!user.usernameChangeRequired,403,'Update your username before changing your link.');
   requireThat(await tx.get('assignment:'+user.uid),409,'Get your Grove link first.');
   requireThat((user.linkRotationAvailableAt||0)<=now(),429,'You can change your link once every seven days.');
   const row=await assignUser(tx,user,{replace:true,reason:'User requested a replacement for a blocked link'});
   const rotationAvailableAt=now()+7*86400;
   await tx.put('user:'+user.uid,{...user,linkRotationAvailableAt:rotationAvailableAt});
   return {...safeEndpoint(await tx.get('endpoint:'+hash(row.origin))),assignedAt:row.assignedAt,rotationAvailableAt};
  });
 }
 async function rebalance(){
                                                                    
  const jobs=await store.list('link-jobs',{limit:20});let moved=0;
  for(const job of jobs.items.sort((a,b)=>(a.lastAttempt||0)-(b.lastAttempt||0)).slice(0,1)){
   const key='link-job:'+hash(job.origin);
   const endpoint=await store.get('endpoint:'+hash(job.origin));
   if(!endpoint?.blocked){await atomic(store,async tx=>{const current=await tx.get(key),latest=await tx.get('endpoint:'+hash(job.origin));if(current?.id===job.id&&!latest?.blocked)await tx.remove(key);});continue;}
   const page=await store.list('users',{cursor:job.cursor||undefined,limit:10});let unavailable=false;
   for(const entry of page.items){if(effectiveUser(entry,now()).status!=='active')continue;try{const changed=await atomic(store,async tx=>{const user=effectiveUser(await tx.get('user:'+entry.uid),now()),assigned=await tx.get('assignment:'+entry.uid);if(user?.status!=='active'||assigned?.origin!==job.origin)return false;const next=await assignUser(tx,user,{reason:'Previous link blocked by administrator'});return next.origin!==assigned.origin;});if(changed)moved++;}catch(error){if(error.status!==503)throw error;unavailable=true;break;}}
   await atomic(store,async tx=>{const current=await tx.get(key);if(!current||current.id!==job.id||(current.cursor||null)!==(job.cursor||null))return;if(unavailable||page.cursor)await tx.put(key,{...current,lastAttempt:now(),cursor:unavailable?current.cursor:page.cursor});else await tx.remove(key);});
  }
  return {moved};
 }
 async function report(access,body){
  requireThat(['connection','tls','server','slow','network-policy','other'].includes(body.reason),400,'Choose a report reason.');
  requireThat(body.details===undefined||typeof body.details==='string'&&body.details.length<=1000,400,'Keep details under 1,000 characters.');
  const id=randomUUID();
  const result=await atomic(store,async tx=>{
   const {user}=await authorize(tx,access),assigned=await tx.get('assignment:'+user.uid);requireThat(assigned,409,'Get your Grove link first.');
   const guard=await tx.get('report-guard:'+user.uid)||{count:0,window:now(),score:0,cooldownUntil:0};
   requireThat(!guard.restricted&&guard.cooldownUntil<=now(),429,guard.restricted?'Reporting requires administrator review. You can appeal through Support.':'Reporting is cooling down. Try later or contact Support.');
   const recent=now()-guard.window<config.reportWindowSeconds,count=(recent?guard.count:0)+1;
   if(count>config.reportLimit){await tx.put('report-guard:'+user.uid,{...guard,count,window:recent?guard.window:now(),cooldownUntil:now()+config.reportCooldownSeconds});return {cooldown:true};}
   const endpoint=await tx.get('endpoint:'+hash(assigned.origin)),healthy=effective(endpoint)==='operational',policy=body.reason==='network-policy';
   const score=Math.max(0,(recent?guard.score:0)+(healthy?1:0));
   await tx.put('report-guard:'+user.uid,{...guard,count,score,window:recent?guard.window:now()});
   const value={kind:'reports',sort:now()+':'+id,id,uid:user.uid,origin:assigned.origin,reason:body.reason,details:body.details?.trim()||'',status:policy?'network-policy':'pending',createdAt:now(),score,expires:now()+180*86400};
   await tx.put('report:'+id,value);await tx.put('user-report:'+id,{...value,kind:'reports:'+user.uid});
   const message=policy?'This appears to be a network policy restriction. Contact your network administrator if access is restricted.':healthy?'Report received. The server currently appears healthy; an administrator will review it.':'Report received. An administrator will review the infrastructure failure and recovery options.';
   await notice(tx,user.uid,'report',message);return {id,status:value.status,message,warning:score>=config.reportWarningScore};
  });
  requireThat(!result.cooldown,429,'Reporting is temporarily cooling down. You can still contact Support.');return result;
 }
 async function openRequest(tx,uid,except){
  const guard=await tx.get('support-guard:'+uid);if(guard?.ticket&&guard.ticket!==except){const current=await tx.get('ticket:'+guard.ticket);if(current?.status==='open'&&current.expires>now())return current;}
  let cursor;do{const page=await store.list('tickets:'+uid,{cursor,limit:100});for(const entry of page.items){if(entry.id===except||entry.status!=='open'||entry.expires<=now())continue;const row=await tx.get('ticket:'+entry.id);if(row?.status==='open'&&row.expires>now())return row;}cursor=page.cursor;}while(cursor);return null;
 }
 async function reserveSupport(tx,uid,id){requireThat(!await openRequest(tx,uid,id),409,'You already have an open request. Close it before opening another.');await tx.put('support-guard:'+uid,{ticket:id,updatedAt:now()});}
 async function supportState(access){return atomic(store,async tx=>{const {user}=await authorize(tx,access,{allowRestricted:true});const row=await openRequest(tx,user.uid);return {openTicket:row?{id:row.id,subject:row.subject}:null};});}
 const publicReplies=publicSupport;
 async function readSupport(access,body){return atomic(store,async tx=>{const {user}=await authorize(tx,access,{allowRestricted:true}),row=await tx.get('user-ticket:'+body.id);requireThat(row?.uid===user.uid&&(!row.expires||row.expires>now()),404,'Request not found.');if(row.noticeRevision===body.revision&&row.userUnread){const original=await tx.get('ticket:'+row.id);requireThat(original?.uid===user.uid,404,'Request not found.');await tx.put('ticket:'+row.id,{...original,userUnread:false});await tx.put('user-ticket:'+row.id,{...row,userUnread:false});}return {ok:true};});}
 async function supportThread(access,id){const {user}=await authenticate(access,{allowRestricted:true}),row=await store.get('user-ticket:'+id);requireThat(row?.uid===user.uid&&(!row.expires||row.expires>now()),404,'Request not found.');const {_v,kind,sort,uid,...safe}=publicReplies(row);return safe;}
 async function replySupport(access,body){return atomic(store,async tx=>{
  const {user}=await authorize(tx,access,{allowRestricted:true}),row=await tx.get('ticket:'+body.id);requireThat(row?.uid===user.uid&&(!row.expires||row.expires>now()),404,'Request not found.');requireThat(row.status==='open',409,'This request is closed. Open a new request if you need help.');requireThat(row.replies.length<100,409,'This conversation is full. Close it and open a new request.');
  await rate(tx,'support-reply:'+user.uid,30,60);const changed={...row,adminUnread:true,updatedAt:now(),replies:[...row.replies,{sender:'user',actor:'User',message:plain(body.message,2000,'Message'),at:now()}]};
  if(isAppeal(changed,user))await humanSupport(tx,changed,'Appeal requires an administrator',now(),{appeal:true,provider:config.supportAI});
  else if(asksHuman(body.message)&&changed.supportMode==='ai')await humanSupport(tx,changed,'User requested a human',now(),{provider:config.supportAI});
  else if(changed.supportMode==='ai'&&!changed.claimedBy)await queueSupport(tx,changed,'reply',now());
  await saveSupport(tx,changed);return {ok:true};
 });}
 async function closeSupport(access,id){return atomic(store,async tx=>{
  const {user}=await authorize(tx,access,{allowRestricted:true}),row=await tx.get('ticket:'+id);requireThat(row?.uid===user.uid&&(!row.expires||row.expires>now()),404,'Request not found.');
  await tx.put('support-guard:'+user.uid,{updatedAt:now()});
  const changed={...row,status:'closed',needsAssistance:false,updatedAt:now(),closedBy:'user'};
  changed.aiPending=false;changed.summaryPending=false;changed.aiRevision=(row.aiRevision||0)+1;await tx.remove('support-ai-job:'+id);await saveSupport(tx,changed);await audit(tx,'ticket:user-close',id,'Closed by request owner',user.uid);return {ok:true};
 });}
 async function support(access,body){const subject=plain(body.subject,120,'Subject'),message=plain(body.message,2000,'Message'),id=randomUUID();return atomic(store,async tx=>{
  const {user}=await authorize(tx,access,{allowRestricted:true});await reserveSupport(tx,user.uid,id);await rate(tx,'support:'+user.uid,5,3600);
  const row={kind:'tickets',sort:now()+':'+id,id,uid:user.uid,subject,message,type:body.type==='appeal'?'appeal':'support',status:'open',createdAt:now(),replies:[],expires:now()+180*86400};
  if(isAppeal(row,user))await humanSupport(tx,row,'Appeal requires an administrator',now(),{appeal:true,provider:config.supportAI});
  else if(asksHuman(subject+' '+message))await humanSupport(tx,row,'User requested a human',now(),{provider:config.supportAI});
  else if(config.supportAI){row.supportMode='ai';await queueSupport(tx,row,'reply',now());}
  else row.supportMode='human';
  await saveSupport(tx,row);return {id,status:'open'};
 });}
 async function requestHuman(access,body){return atomic(store,async tx=>{
  const {user}=await authorize(tx,access,{allowRestricted:true}),row=await tx.get('ticket:'+body.id);requireThat(row?.uid===user.uid&&row.expires>now(),404,'Request not found.');requireThat(row.status==='open',409,'This request is closed.');
  if(row.supportMode==='human')return {ok:true};
  await humanSupport(tx,row,'User requested a human',now(),{appeal:isAppeal(row,user),provider:config.supportAI});await saveSupport(tx,row);await audit(tx,'ticket:human',row.id,'User requested a human',user.uid);return {ok:true};
 });}
 async function readNotice(access,id){return atomic(store,async tx=>{const {user}=await authorize(tx,access,{allowRestricted:true}),row=await tx.get('notice:'+id);requireThat(row?.uid===user.uid,404,'Notification not found.');await tx.put('notice:'+id,{...row,read:true});return {ok:true};});}
 async function restriction(access){const {user}=await authenticate(access,{allowRestricted:true});const row=await store.get('report-guard:'+user.uid);return {accountStatus:user.status,reason:user.restrictionReason||'',until:user.restrictionUntil||null,serverTime:now(),reporting:{cooldownUntil:row?.cooldownUntil||0,reviewRequired:!!row?.restricted}};}
 async function deleteAccount(access){return atomic(store,async tx=>{
  const {user,family}=await authorize(tx,access,{allowRestricted:true});requireThat(!user.usernameChangeRequired,403,'Change your username before deleting your account.');requireThat(now()-family.authAt<900,403,'Sign in again before deleting your account.');
  const assigned=await tx.get('assignment:'+user.uid);
  if(assigned){const endpoint=await tx.get('endpoint:'+hash(assigned.origin));if(endpoint)await tx.put('endpoint:'+hash(assigned.origin),{...endpoint,assignments:Math.max(0,(endpoint.assignments||0)-1)});await tx.remove('assignment:'+user.uid);}
  await tx.remove('email:'+hash(user.email));await tx.remove('name:'+user.username);await tx.remove('prefs:'+user.uid);await tx.remove('vault:'+user.uid);await tx.remove('browsing-history:'+user.uid);for(const part of ['meta','draft','published','previous'])await tx.remove('design:'+user.uid+':'+part);
  const restrictionKey=['banned','suspended'].includes(user.status)?'restriction-email:'+hmac(config.internalSecret,user.email):null;
  if(restrictionKey)await tx.put(restrictionKey,{uid:user.uid,status:user.status,createdAt:now(),...(user.status==='suspended'&&user.restrictionUntil?{expires:user.restrictionUntil}:{})});
  await tx.put('user:'+user.uid,{kind:restrictionKey?'deleted-restricted-users':'deleted-users',sort:now()+':'+user.uid,uid:user.uid,status:'deleted',epoch:user.epoch+1,deletedAt:now(),...(restrictionKey?{restrictionKey}:{expires:now()+30*86400})});
  for(const fid of user.devices||[])await tx.remove('family:'+fid);
  await tx.put('cleanup:'+user.uid,{kind:'cleanup',sort:now()+':'+user.uid,uid:user.uid,createdAt:now()});return {ok:true};
 });}
 async function cleanup(){const jobs=await store.list('cleanup',{limit:20});for(const job of jobs.items){
  for(const kind of ['notices','security','reports','tickets','assignments','credentials','admin-notifications']){
   let cursor;do{const page=await store.list(kind+':'+job.uid,{cursor,limit:50});await atomic(store,async tx=>{for(const row of page.items){const key=kind==='credentials'?'refresh:':kind==='notices'?'notice:':kind==='security'?'security:':kind==='reports'?'user-report:':kind==='tickets'?'user-ticket:':kind==='admin-notifications'?'admin-note:':'assignment-history:';await tx.remove(key+row.id);if(kind==='reports')await tx.remove('report:'+row.id);if(kind==='tickets')await tx.remove('ticket:'+row.id);}});cursor=page.cursor;}while(cursor);
  }
  await atomic(store,async tx=>{await tx.remove('report-guard:'+job.uid);await tx.remove('cleanup:'+job.uid);});
 }}
 async function admin(action,body={}){
  if(action==='refresh'){
   requireThat(body.scope==='all'||body.scope==='account',400,'Choose one account or all users.');
   requireThat(body.scope!=='all'||body.confirmAll===true,400,'Confirm refreshing all users.');
   const reason=plain(body.reason,200,'Reason');
   if(body.scope==='account')requireThat(/^fr_[a-f0-9-]{36}$/.test(body.uid||''),400,'Choose a valid account.');
   return atomic(store,async tx=>{
    const target=body.scope==='all'?'all':body.uid;
    const key=body.scope==='all'?'browser-refresh:all':'user:'+body.uid;
    const raw=await tx.get(key),row=body.scope==='account'?effectiveUser(raw,now()):raw;
    if(body.scope==='account')requireThat(row?.status==='active',404,'Active account not found.');
    requireThat(!row?.browserRefreshAt||now()-row.browserRefreshAt>=30,429,'Wait 30 seconds before refreshing this target again.');
    const revision=(row?.browserRefreshRevision||0)+1;
    await tx.put(key,{...row,browserRefreshRevision:revision,browserRefreshAt:now()});
    await audit(tx,'browser:refresh',target,reason);
    return {ok:true,scope:body.scope,revision};
   });
  }
  if(action==='list'){
   requireThat(['users','deleted-restricted-users','endpoints','reports','tickets','audit','incidents','health'].includes(body.kind),400,'Invalid collection.');
   if(body.kind==='tickets'&&body.status){
    requireThat(['open','closed','assistance','unclaimed','all'].includes(body.status),400,'Invalid support filter.');
    const items=[];let cursor=body.cursor;
    for(let batch=0;batch<10;batch++){const page=await store.list('tickets',{cursor,limit:50});items.push(...page.items.filter(r=>(!r.expires||r.expires>now())&&(body.status==='all'||(body.status==='assistance'?r.status==='open'&&r.needsAssistance:body.status==='unclaimed'?r.status==='open'&&!r.claimedBy&&r.supportMode!=='ai':r.status===body.status))));cursor=page.cursor;if(items.length||!cursor)break;}
    return {items:await Promise.all(items.map(async({_v,kind,sort,...row})=>({...row,username:(await store.get('user:'+row.uid))?.username||'Deleted account'}))),cursor};
   }
   if(body.kind==='audit'){
    const page=await store.list('audit',{cursor:body.cursor,limit:50});return {items:await Promise.all(page.items.map(async({_v,kind,sort,...row})=>({...row,actorUsername:row.actorUsername||(row.actor&&row.actor!=='totp-owner'?(await store.get('user:'+row.actor))?.username:null)||null}))),cursor:page.cursor};
   }
   const page=await store.list(body.kind,{cursor:body.cursor,limit:50});const query=typeof body.query==='string'?body.query.toLowerCase().slice(0,254):'';
   return {items:page.items.map(row=>body.kind==='users'?effectiveUser(row,now()):row).filter(row=>!query||[row.uid,row.username,row.email,row.origin,row.id].some(x=>x?.toLowerCase().includes(query))).map(({_v,googleSub,devices,epoch,kind,sort,restrictionKey,...row})=>row),cursor:page.cursor};
  }
  if(action==='links')return {items:await Promise.all(config.endpoints.map(async origin=>{const row=await store.get('endpoint:'+hash(origin));return {origin,status:effective(row),blocked:!!row?.blocked,assignments:row?.assignments||0,lastChecked:row?.lastChecked||null,reason:row?.blockReason||'',moving:!!await store.get('link-job:'+hash(origin))};}))};
  if(action==='assign')return atomic(store,async tx=>{if(authorizeTarget)await authorizeTarget(tx,body.uid,'assign');const user=effectiveUser(await tx.get('user:'+body.uid),now());requireThat(user?.status==='active',404,'Active account not found.');const destination=approvedOrigin(body.origin,config.endpoints),reason=plain(body.reason,200,'Reason');const result=await assignUser(tx,user,{destination,reason});await audit(tx,'assign',user.uid,reason+' → '+destination);return result;});
  if(action==='link'){
   const origin=approvedOrigin(body.origin,config.endpoints),reason=plain(body.reason,200,'Reason');requireThat(['block','unblock'].includes(body.action),400,'Choose block or unblock.');
   await atomic(store,async tx=>{const key='endpoint:'+hash(origin),row=await tx.get(key);requireThat(row,404,'Link is not registered.');await tx.put(key,{...row,blocked:body.action==='block',blockReason:body.action==='block'?reason:'',blockedAt:body.action==='block'?now():null});if(body.action==='block')await tx.put('link-job:'+hash(origin),{kind:'link-jobs',sort:origin,id:randomUUID(),origin,cursor:null});else await tx.remove('link-job:'+hash(origin));await audit(tx,'link:'+body.action,origin,reason);});
   if(body.action==='block')await rebalance();return {ok:true};
  }
  if(action==='clear-deleted-restriction')return atomic(store,async tx=>{
   const user=effectiveUser(await tx.get('user:'+body.uid),now()),reason=plain(body.reason,200,'Reason');
   requireThat(user?.status==='deleted'&&user.restrictionKey,404,'Deleted restriction not found.');
   const guard=await tx.get(user.restrictionKey);if(guard?.uid===user.uid)await tx.remove(user.restrictionKey);await tx.remove('user:'+user.uid);await audit(tx,action,user.uid,reason);return {ok:true};
  });
  if(action==='user')return atomic(store,async tx=>{
   if(authorizeTarget)await authorizeTarget(tx,body.uid,body.action);
   const user=effectiveUser(await tx.get('user:'+body.uid),now());requireThat(user&&user.status!=='deleted',404,'Account not found.');const reason=plain(body.reason,200,'Reason');
   requireThat(['reset-username','force-username','ban','suspend','unban','revoke','reset-reports','restrict-reports'].includes(body.action),400,'Invalid user action.');
   if(body.action==='reset-username'){
    requireThat(user.status==='active',409,'Choose an active account.');
    const roster=await tx.get('staff-roster');requireThat(roster?.owner!==user.uid,403,'The owner account is protected.');
    const name='grove_user_'+user.uid,claim=await tx.get('name:'+name);
    requireThat(!claim||claim.uid===user.uid,409,'The reset username is already reserved.');
    const oldClaim=await tx.get('name:'+user.username);
    if(user.username!==name&&oldClaim?.uid===user.uid)await tx.remove('name:'+user.username);
    await tx.put('name:'+name,{uid:user.uid});
    await tx.put('user:'+user.uid,{...user,username:name,usernameChangeRequired:false,usernameChangeReason:null,disallowedUsernames:[...new Set([...(user.disallowedUsernames||[]),...(user.username!==name?[user.username]:[])])]});
    await notice(tx,user.uid,'account','An administrator reset your username to '+name+'. Reason: '+reason);
    await audit(tx,body.action,user.uid,reason+' — '+user.username+' → '+name);
    return {ok:true,username:name};
   }
   if(body.action==='force-username'){requireThat(['Inappropriate username','Impersonation','Personal information','Other'].includes(body.usernameReason),400,'Select a username-change reason.');requireThat(user.status==='active',409,'Choose an active account.');const roster=await tx.get('staff-roster');requireThat(roster?.owner!==user.uid,403,'The owner account is protected.');const explanation=body.usernameReason+(reason?' — '+reason:'');await tx.put('user:'+user.uid,{...user,usernameChangeRequired:true,usernameChangeReason:explanation,disallowedUsernames:[...new Set([...(user.disallowedUsernames||[]),user.username])]});await notice(tx,user.uid,'account','Choose a new username before continuing. Reason: '+explanation);}
   else if(['ban','suspend','unban','revoke'].includes(body.action)){
    if(body.action==='suspend')requireThat(Number.isSafeInteger(body.durationSeconds)&&body.durationSeconds>=60&&body.durationSeconds<=365*86400,400,'Choose a suspension duration between 1 minute and 365 days.');
    const status=body.action==='ban'?'banned':body.action==='suspend'?'suspended':body.action==='unban'?'active':user.status;
    const restrictionUntil=body.action==='suspend'?now()+body.durationSeconds:body.action==='revoke'?(user.restrictionUntil||null):null;
    await tx.put('user:'+user.uid,{...user,status,epoch:user.epoch+1,restrictionUntil,restrictionReason:body.action==='revoke'?(user.restrictionReason||''):status==='active'?'':reason});
    await notice(tx,user.uid,'account',status==='active'?'Account access restored. Sign in again.':'Your account access changed. Visit Support to review or appeal.');
   }
   else{const row=await tx.get('report-guard:'+user.uid)||{};await tx.put('report-guard:'+user.uid,{...row,cooldownUntil:0,count:0,score:0,restricted:body.action==='restrict-reports'});}
   await audit(tx,body.action,user.uid,body.action==='force-username'?body.usernameReason+' — '+reason:body.action==='suspend'?reason+' (duration: '+body.durationSeconds+' seconds)':reason);return {ok:true};
  });
  if(action==='endpoint')return atomic(store,async tx=>{
   const origin=approvedOrigin(body.origin,config.endpoints),key='endpoint:'+hash(origin),old=await tx.get(key),reason=plain(body.reason,200,'Reason');
   requireThat(['register','operational','degraded','unavailable','maintenance','retired','automatic'].includes(body.action),400,'Invalid endpoint action.');
   requireThat(body.capacity===undefined||Number.isInteger(body.capacity)&&body.capacity>=0&&body.capacity<=100000,400,'Invalid capacity.');
   const row={kind:'endpoints',sort:origin,origin,assignments:0,observed:'unavailable',failures:0,successes:0,totalChecks:0,successfulChecks:0,...old,capacity:body.capacity??old?.capacity??0};
   if(body.action!=='register')row.override=body.action==='automatic'?null:body.action;
   row.overrideReason=reason;await tx.put(key,row);await audit(tx,'endpoint:'+body.action,origin,reason);return safeEndpoint(row);
  });
  if(action==='report')return atomic(store,async tx=>{
   const row=await tx.get('report:'+body.id);requireThat(row&&row.status==='pending',409,'Report is no longer pending.');const reason=plain(body.reason,200,'Reason');
   requireThat(['dismiss','approve-replacement'].includes(body.action),400,'Invalid report action.');
   if(body.action==='approve-replacement'){
    requireThat(row.reason!=='network-policy',403,'Network-policy restrictions are not eligible for link rotation.');
    const user=effectiveUser(await tx.get('user:'+row.uid),now()),assignment=await tx.get('assignment:'+row.uid),old=await tx.get('endpoint:'+hash(row.origin));
    requireThat(user?.status==='active'&&assignment?.origin===row.origin&&old?.observed==='unavailable'&&old.failures>=config.failureThreshold,409,'A confirmed infrastructure outage on the current assignment is required.');
    const destination=approvedOrigin(body.origin,config.endpoints),next=await tx.get('endpoint:'+hash(destination));
    requireThat(destination!==row.origin&&next&&effective(next)==='operational'&&(!next.capacity||next.assignments<next.capacity),409,'Replacement endpoint is unavailable.');
    await tx.put('endpoint:'+hash(row.origin),{...old,assignments:Math.max(0,old.assignments-1)});await tx.put('endpoint:'+hash(destination),{...next,assignments:next.assignments+1});
    await tx.put('assignment:'+row.uid,{uid:row.uid,origin:destination,assignedAt:now()});
    const id=randomUUID();await tx.put('assignment-history:'+id,{kind:'assignments:'+row.uid,sort:now()+':'+id,id,uid:row.uid,origin:destination,previousOrigin:row.origin,assignedAt:now(),expires:now()+365*86400});
   }
   const changed={...row,status:body.action==='dismiss'?'dismissed':'replaced',resolution:reason,resolvedAt:now()};await tx.put('report:'+row.id,changed);await tx.put('user-report:'+row.id,{...changed,kind:'reports:'+row.uid});
   await notice(tx,row.uid,'report',body.action==='dismiss'?'Your link report was reviewed. See the report for details.':'An administrator approved a replacement for a confirmed outage. Your Grove link has been updated.');await audit(tx,body.action,row.id,reason);return {ok:true};
  });
  if(action==='notify')return atomic(store,async tx=>{
   if(authorizeActor)await authorizeActor(tx);
   if(actor!=='totp-owner'){const roster=await tx.get('staff-roster'),sender=effectiveUser(await tx.get('user:'+actor),now());requireThat(sender?.status==='active'&&!sender.usernameChangeRequired&&(roster?.owner===actor||roster?.admins?.includes(actor)),403,'Administrator access required.');}
   const user=await tx.get('user:'+body.uid);requireThat(user&&user.status!=='deleted',404,'Account not found.');const message=plain(body.message,500,'Notification');await rate(tx,'admin-note-sender:'+actor,30,3600);await rate(tx,'admin-note-target:'+user.uid,5,60);
   const id=randomUUID(),row={id,uid:user.uid,type:'admin-message',message,createdAt:now(),sort:now()+':'+id,expires:now()+30*86400};await tx.put('notice:'+id,{...row,kind:'notices:'+user.uid,read:false});await tx.put('admin-note:'+id,{...row,kind:'admin-notifications:'+user.uid});await audit(tx,'notification:send',user.uid,'Notification '+id);return {ok:true,id};
  });
  if(action==='ticket-create')return atomic(store,async tx=>{
   const user=await tx.get('user:'+body.uid);requireThat(user&&user.status!=='deleted',404,'Account not found.');
   const id=randomUUID();await reserveSupport(tx,user.uid,id);await rate(tx,'support-start:'+actor,30,3600);
   const row={kind:'tickets',sort:now()+':'+id,id,uid:user.uid,subject:plain(body.subject,120,'Subject'),message:plain(body.message,2000,'Message'),initialSender:'admin',userUnread:true,noticeRevision:0,type:'support',status:'open',createdAt:now(),updatedAt:now(),replies:[],claimedBy:actor,claimedUsername:actor==='totp-owner'?'TOTP owner':(await tx.get('user:'+actor))?.username||actor,claimedAt:now(),expires:now()+180*86400};
   await tx.put('ticket:'+id,row);const {claimedBy,claimedUsername,claimedAt,...safe}=row;await tx.put('user-ticket:'+id,{...safe,kind:'tickets:'+user.uid});await notice(tx,user.uid,'support','An administrator started a support conversation with you.');await audit(tx,'ticket:create',id,'Support conversation started');return {id};
  });
  if(action==='ticket')return atomic(store,async tx=>{
   const row=await tx.get('ticket:'+body.id);requireThat(row&&(!row.expires||row.expires>now()),404,'Ticket not found.');
   const operation=body.operation||'reply';requireThat(['read','reply','close','reopen','assist','claim','unclaim','assign','ai'].includes(operation),400,'Invalid support action.');
   if(operation==='read'){if(body.markRead===true&&row.claimedBy===actor&&row.adminUnread){row.adminUnread=false;await tx.put('ticket:'+row.id,row);}const {_v,kind,sort,...safe}=row;return {...safe,username:(await tx.get('user:'+row.uid))?.username||'Deleted account'};}
   let changed={...row,updatedAt:now()},result={ok:true};
   if(operation==='reply'){
    requireThat(row.status==='open',409,'Reopen and claim this request before replying.');
    requireThat(row.claimedBy===actor,409,row.claimedBy?'Another administrator has claimed this request.':'Claim this request before replying.');
    requireThat(['open','closed'].includes(body.status),400,'Choose a ticket status.');requireThat(row.replies.length<100,409,'Ticket reply limit reached.');
    changed={...changed,userUnread:true,noticeRevision:row.replies.length+1,status:row.status,replies:[...row.replies,{sender:'admin',actor:'Administrator',message:plain(body.message,2000,'Reply'),at:now()}]};
   }else if(operation==='close'){changed.status='closed';changed.needsAssistance=false;}
   else if(operation==='reopen'){changed.status='open';changed.claimedBy=null;changed.claimedUsername=null;}
   else if(operation==='assist'){requireThat(row.status==='open',409,'Reopen the request first.');changed.needsAssistance=true;changed.claimedBy=null;changed.claimedUsername=null;changed.assistanceRequestedBy=actor;changed.assistanceRequestedAt=now();}
   else if(operation==='claim'){requireThat(row.status==='open',409,'Reopen the request first.');requireThat(!row.claimedBy||row.claimedBy===actor,409,'Another administrator already claimed this request.');changed.needsAssistance=false;changed.claimedBy=actor;changed.claimedUsername=actor==='totp-owner'?'TOTP owner':(await tx.get('user:'+actor))?.username||actor;changed.claimedAt=now();}
   else if(operation==='unclaim'){requireThat(row.status==='open',409,'Reopen the request first.');requireThat(row.claimedBy===actor,409,'Only the assigned administrator can unclaim this request.');changed.claimedBy=null;changed.claimedUsername=null;}
   else if(operation==='assign'){
    if(authorizeTarget)await authorizeTarget(tx,row.uid,'assign');
    requireThat(row.status==='open',409,'Reopen the request first.');
    const user=effectiveUser(await tx.get('user:'+row.uid),now());requireThat(user?.status==='active',409,'This account must be active before assigning a link.');
    const assignment=await assignUser(tx,user,{replace:true,reason:'Support request '+row.id});result.origin=assignment.origin;changed.lastAssignedOrigin=assignment.origin;changed.lastAssignedAt=now();
   }
   if(operation==='ai'){
    requireThat(row.status==='open'&&row.claimedBy===actor,409,'Claim this request before handing it to AI.');
    const user=effectiveUser(await tx.get('user:'+row.uid),now());requireThat(user?.status==='active'&&!isAppeal(row,user),409,'Appeals and restricted accounts require human support.');requireThat(config.supportAI,503,'AI support is unavailable.');
    requireThat(row.replies.length<98,409,'This conversation is full.');changed.supportMode='ai';changed.claimedBy=null;changed.claimedUsername=null;changed.needsAssistance=false;changed.adminUnread=false;await queueSupport(tx,changed,'reply',now());
   }else if(['claim','reply','close','reopen','assist','unclaim'].includes(operation)){
    if(row.supportMode==='ai'&&operation==='claim')await humanSupport(tx,changed,'Administrator took over',now(),{provider:config.supportAI});
    else if(row.supportMode==='ai'){changed.supportMode='human';changed.aiPending=false;changed.summaryPending=false;changed.aiRevision=(row.aiRevision||0)+1;await tx.remove('support-ai-job:'+row.id);}
   }
   if(changed.status==='open')await reserveSupport(tx,row.uid,row.id);else {changed.needsAssistance=false;await tx.put('support-guard:'+row.uid,{updatedAt:now()});}
   await saveSupport(tx,changed);
   if(['reply','close','reopen'].includes(operation))await notice(tx,row.uid,'support',operation==='reply'?'An administrator replied to your support request.':operation==='close'?'Your support request was closed.':'Your support request was reopened.');
   await audit(tx,'ticket:'+operation,row.id,operation==='assign'?'New link: '+result.origin:'Support request '+operation);return result;
  });
  if(action==='incident')return atomic(store,async tx=>{const row=await tx.get('incident:'+body.id);requireThat(row,404,'Incident not found.');const reason=plain(body.reason,200,'Reason');await tx.put('incident:'+row.id,{...row,acknowledgedAt:now(),acknowledgedBy:'totp-owner',acknowledgment:reason});await audit(tx,'incident:acknowledge',row.id,reason);return {ok:true};});
  throw new Error('Unknown admin operation.');
 }
 return {assignment,allocate,rotateLink,rebalance,report,support,supportState,supportThread,requestHuman,readSupport,replySupport,closeSupport,ownedList,readNotice,restriction,deleteAccount,cleanup,admin,effective,safeEndpoint};
}
