import {termsVersion} from './terms-document.mjs';
import {effectiveUser} from './restrictions.mjs';
import {recordOnline} from './online.mjs';
import {randomUUID} from 'node:crypto';
import {atomic} from './store.mjs';
import {token,frostId,hash,hmac,isToken,requireThat,emailAddress,username,deviceInfo,plain,cleanPreferences,Problem} from './security.mjs';

export function createAccounts({store,config,now=()=>Math.floor(Date.now()/1000)}){
 const currentTerms=()=>config.termsVersion||termsVersion;
 const needsTerms=user=>user.termsAcceptedVersion!==currentTerms();
 const requireTerms=user=>{if(needsTerms(user))throw new Problem(403,'Review and agree to the updated Terms of Service in the dispenser.','TERMS_ACCEPTANCE_REQUIRED');};
 const live=row=>row&&(!row.expires||row.expires>now());
 const publicUser=user=>({frostId:user.uid,terms:{version:currentTerms(),required:needsTerms(user),acceptedAt:user.termsAcceptedAt||null},username:user.username,email:user.email,createdAt:user.createdAt,status:user.status,restrictionUntil:user.restrictionUntil||null,usernameChangeRequired:!!user.usernameChangeRequired,usernameChangeReason:user.usernameChangeRequired?user.usernameChangeReason:null});
 const csrf=fid=>hmac(config.internalSecret,'csrf:'+fid);
 async function notice(tx,uid,type,message){const id=randomUUID();await tx.put('notice:'+id,{kind:'notices:'+uid,sort:now()+':'+id,id,uid,type,message,createdAt:now(),read:false,expires:now()+30*86400});}
 async function security(tx,uid,action){const id=randomUUID();await tx.put('security:'+id,{kind:'security:'+uid,sort:now()+':'+id,id,uid,action,at:now(),expires:now()+90*86400});}
 async function rate(tx,key,limit,window){const bucket=Math.floor(now()/window),id='rate:'+key+':'+bucket,row=await tx.get(id);if((row?.count||0)>=limit){const retryAfter=Math.max(1,(bucket+1)*window-now()),minutes=Math.ceil(retryAfter/60),error=new Problem(429,`Too many attempts. Try again in ${minutes} ${minutes===1?'minute':'minutes'}.`);error.retryAfter=retryAfter;throw error;}await tx.put(id,{count:(row?.count||0)+1,expires:(bucket+2)*window});}
 async function issue(tx,user,family,scope,origin){
  const access=token(),refresh=token();
  const common={uid:user.uid,fid:family.fid,epoch:user.epoch,scope,origin};
  await tx.put('access:'+hash(access),{...common,expires:now()+900});
  // Active device grants do not time out. Browser cookies are renewed on use;
  // rotation, explicit logout, revocation and account epochs still invalidate them.
  await tx.put('refresh:'+hash(refresh),{...common,kind:'credentials:'+user.uid,id:hash(refresh),sort:now()+':'+hash(refresh),used:false});
  return {access,refresh,expiresIn:900,refreshExpiresIn:400*86400,csrf:csrf(family.fid)};
 }
 async function familyFor(tx,user,userAgent){
  const active=[];
  for(const fid of user.devices||[]){const row=await tx.get('family:'+fid);if(live(row)&&!row.revoked&&row.epoch===user.epoch)active.push(row);}
  // A newly verified identity must be able to recover after losing browser data.
  // Retire the least recently active device at the cap rather than lock out login.
  active.sort((a,b)=>a.lastActive-b.lastActive);
  if(active.length>=20){const retired=active.shift();await tx.put('family:'+retired.fid,{...retired,revoked:true,revokedAt:now()});await security(tx,user.uid,'Oldest device retired at the device limit');}
  const alive=active.map(row=>row.fid);
  const fid=randomUUID(),family={kind:'devices:'+user.uid,sort:now()+':'+fid,fid,uid:user.uid,epoch:user.epoch,...deviceInfo(userAgent),firstSeen:now(),lastActive:now(),authAt:now(),revoked:false};
  await tx.put('family:'+fid,family);await tx.put('user:'+user.uid,{...user,devices:[...alive,fid]});
  await notice(tx,user.uid,'security','A new device signed in: '+family.label+'.');await security(tx,user.uid,'New device signed in');
  return family;
 }
 async function authorize(tx,access,{scope='account',origin=config.origin,allowRestricted=false}={}){
  requireThat(isToken(access),401,'Sign in to continue.');
  const session=await tx.get('access:'+hash(access));requireThat(live(session)&&session.scope===scope&&session.origin===origin,401,'Your session expired. Sign in again.');
  const user=effectiveUser(await tx.get('user:'+session.uid),now()),family=await tx.get('family:'+session.fid);
  if(scope==='browse'&&user&&['banned','suspended'].includes(user.status))throw new Problem(403,'Visit the dispenser to review or appeal this restriction.','ACCOUNT_RESTRICTED');
  requireThat(user&&live(family)&&!family.revoked&&session.epoch===user.epoch,401,'This device session is no longer active.');
  requireThat(user.status==='active'||allowRestricted&&['suspended','banned'].includes(user.status),403,'This account is restricted. Use Support in the dispenser.');
  if(scope==='browse'&&user.usernameChangeRequired)throw new Problem(403,'Change your username in the dispenser to continue.','USERNAME_CHANGE_REQUIRED');
  if(scope==='browse')requireTerms(user);
  return {user,family,session};
 }
 async function authenticate(access,options){return atomic(store,tx=>authorize(tx,access,options));}
 async function refresh(raw,scope='account',origin=config.origin){
  requireThat(isToken(raw),401,'Sign in again.');
  const result=await atomic(store,async tx=>{
   const key='refresh:'+hash(raw),old=await tx.get(key);requireThat(live(old)&&old.scope===scope&&old.origin===origin,401,'Sign in again.');
   const user=effectiveUser(await tx.get('user:'+old.uid),now()),family=await tx.get('family:'+old.fid);
   if(scope==='browse'&&user&&['banned','suspended'].includes(user.status))throw new Problem(403,'Visit the dispenser to review or appeal this restriction.','ACCOUNT_RESTRICTED');
   requireThat(user&&live(family)&&!family.revoked&&old.epoch===user.epoch&&user.status!=='deleted',401,'This device session is no longer active.');
   if(scope==='browse')requireTerms(user);
   if(old.used){
    if(now()-old.usedAt<=10)return {error:409,message:'Another tab refreshed this session. Retry shortly.'};
    await tx.put('family:'+family.fid,{...family,revoked:true,revokedAt:now()});await security(tx,user.uid,'Refresh credential reuse detected; device revoked');
    return {error:401,message:'Session reuse detected. Sign in again.'};
   }
   requireThat(scope==='account'||user.status==='active',403,'This account cannot browse right now.');
   await tx.put(key,{...old,used:true,usedAt:now(),expires:now()+30*86400});
   await tx.put('family:'+family.fid,{...family,lastActive:now()});
   return issue(tx,user,family,scope,origin);
  });
  if(result.error)throw new Problem(result.error,result.message);return result;
 }
 async function bootstrap(refreshToken){
  if(!isToken(refreshToken))return {signedIn:false};
  const row=await store.get('refresh:'+hash(refreshToken));
  if(!live(row)||row.scope!=='account'||row.origin!==config.origin)return {signedIn:false};
  const family=await store.get('family:'+row.fid),user=effectiveUser(await store.get('user:'+row.uid),now());
  return live(family)&&!family.revoked&&user&&user.status!=='deleted'&&user.epoch===row.epoch?{signedIn:true,csrf:csrf(row.fid)}:{signedIn:false};
 }
 async function available(name){const normalized=username(name),claim=await store.get('name:'+normalized);return !live(claim);}
 async function register(body,ip){
  requireThat(config.formUrl&&config.formId&&config.formsSecret,503,'Registration is not configured yet.');
  requireThat(!body.website,400,'Registration could not be accepted.');
  const email=emailAddress(body.email),name=username(body.username),poll=token(),proof=token(),uid=frostId();
  // Count rejected username attempts too: this commit must survive a later conflict.
  await atomic(store,async tx=>{await rate(tx,'registration:'+hmac(config.internalSecret,ip||'unknown'),5,900);await rate(tx,'registration:global',100,3600);});
  await atomic(store,async tx=>{
   const claim=await tx.get('name:'+name);requireThat(!live(claim),409,'That username is unavailable.');
   const expires=now()+900;
   await tx.put('name:'+name,{uid,expires});
   await tx.put('pending:'+hash(poll),{uid,email,username:name,status:'pending',expires,createdAt:now()});
   await tx.put('proof:'+hash(proof),{pending:hash(poll),expires});
  });
  const form=new URL(config.formUrl);
  return {poll,siteCode:proof,formUrl:form.href,expiresIn:900};
 }
 async function startVerification(body,ip,access){
  requireThat(config.formUrl&&config.formId&&config.formsSecret,503,'Email verification is not configured yet.');
  const email=emailAddress(body.email),purpose=body.purpose==='email'?'email':body.purpose==='entry'?'entry':'login',poll=token(),proof=token();
  await atomic(store,async tx=>{await rate(tx,'verification:'+hmac(config.internalSecret,ip||'unknown'),5,900);await rate(tx,'verification:global',100,3600);});
  await atomic(store,async tx=>{
   let binding={};
   if(purpose==='email'){const {user,family}=await authorize(tx,access);requireThat(now()-family.authAt<900,403,'Verify your current email again before changing it.');binding={uid:user.uid,fid:family.fid,epoch:user.epoch};}
   await tx.put('pending:'+hash(poll),{purpose,email,...binding,status:'pending',expires:now()+900,createdAt:now()});
   await tx.put('proof:'+hash(proof),{pending:hash(poll),expires:now()+900});
  });
  const form=new URL(config.formUrl);
  return {poll,siteCode:proof,formUrl:form.href,expiresIn:900};
 }
 async function verifiedEvent(body){
  requireThat(body.formId===config.formId&&typeof body.eventId==='string'&&body.eventId.length<=200&&isToken(body.correlation),400,'Invalid verification event.');
  const email=emailAddress(body.email),event='verified:'+hash(body.eventId);
  const verified={status:'verified'};
  return atomic(store,async tx=>{
   if(await tx.get(event))return {ok:true};
   const key='proof:'+hash(body.correlation),proof=await tx.get(key);requireThat(live(proof),410,'Registration expired.');
   const pending=await tx.get('pending:'+proof.pending);requireThat(live(pending)&&pending.email===email,400,'Verified email does not match registration.');
   requireThat(pending.status==='pending',409,'This verification was already submitted. Start again if needed.');
   const existing=await tx.get('email:'+hash(email));
   if(['login','entry','email'].includes(pending.purpose)){
    if(pending.purpose==='login'||pending.purpose==='entry'){
     const user=existing&&effectiveUser(await tx.get('user:'+existing.uid),now());
     await tx.put('pending:'+proof.pending,{...pending,...verified,status:user&&user.status!=='deleted'?'verified':pending.purpose==='entry'?'needs_username':'missing',...(user?{uid:user.uid,epoch:user.epoch}:{})});
    }else await tx.put('pending:'+proof.pending,{...pending,...verified});
    await tx.put(event,{expires:now()+86400});return {ok:true};
   }
   const name=await tx.get('name:'+pending.username);
   requireThat(name?.uid===pending.uid,409,'Username reservation expired. Start again.');
   if(existing){
    await tx.put('pending:'+proof.pending,{...pending,status:'existing'});await tx.remove('name:'+pending.username);
   }else{
    const restriction=await tx.get('restriction-email:'+hmac(config.internalSecret,email));
    requireThat(!live(restriction),403,'This identity is restricted. Contact Frost support to appeal.');
    const user={kind:'users',sort:now()+':'+pending.uid,uid:pending.uid,email,username:pending.username,status:'active',createdAt:now(),verifiedAt:now(),epoch:1,devices:[]};
    await tx.put('user:'+user.uid,user);await tx.put('email:'+hash(email),{uid:user.uid});await tx.put('name:'+user.username,{uid:user.uid});
    await tx.put('pending:'+proof.pending,{...pending,...verified});await notice(tx,user.uid,'account','Your account is verified. Welcome to Frost.');
   }
   await tx.put(event,{expires:now()+86400});return {ok:true};
  });
 }
 async function registrationStatus(poll){requireThat(isToken(poll),401,'Start registration again.');const pending=await store.get('pending:'+hash(poll));requireThat(live(pending),410,'Registration expired. Start again.');return {status:pending.status};}
 async function completeRegistration(poll,userAgent,access,body={}){
  requireThat(isToken(poll),401,'Start registration again.');
  // Commit the username-attempt budget separately so rejected names still count.
  // Only a live verified browser proof can create this rate bucket.
  await atomic(store,async tx=>{
   const pending=await tx.get('pending:'+hash(poll));
   if(live(pending)&&pending.purpose==='entry'&&pending.status==='needs_username')await rate(tx,'profile:'+hash(poll),10,900);
  });
  const result=await atomic(store,async tx=>{
   const key='pending:'+hash(poll),pending=await tx.get(key);requireThat(live(pending)&&(pending.status==='verified'||pending.purpose==='entry'&&pending.status==='needs_username'),409,'Finish Google verification first.');
   if(pending.purpose==='entry'&&pending.status==='needs_username'){
    // Another request may have created this identity since verification. Never
    // adopt its current epoch: that could revive proof predating a revocation.
    const existing=await tx.get('email:'+hash(pending.email));
    requireThat(!existing,409,'Account changed. Verify your email again.');
     requireThat(!live(await tx.get('restriction-email:'+hmac(config.internalSecret,pending.email))),403,'This identity is restricted. Contact Frost support to appeal.');
     const name=username(body.username),claim=await tx.get('name:'+name);requireThat(!live(claim),409,'That username is unavailable. Try another one.');
     const uid=frostId(),user={kind:'users',sort:now()+':'+uid,uid,email:pending.email,username:name,status:'active',createdAt:now(),verifiedAt:now(),epoch:1,devices:[]};
     await tx.put('user:'+uid,user);await tx.put('email:'+hash(user.email),{uid});await tx.put('name:'+name,{uid});await notice(tx,uid,'account','Your account is verified. Welcome to Frost.');
    await tx.put(key,{...pending,status:'claimed'});const family=await familyFor(tx,user,userAgent);return issue(tx,user,family,'account',config.origin);
   }
   if(pending.purpose==='email'){
    const {user,family}=await authorize(tx,access);requireThat(user.uid===pending.uid&&family.fid===pending.fid&&user.epoch===pending.epoch,401,'Account session changed. Verify again.');
    requireThat(!live(await tx.get('restriction-email:'+hmac(config.internalSecret,pending.email))),403,'This identity is restricted. Contact Frost support to appeal.');
    const claim=await tx.get('email:'+hash(pending.email));requireThat(!claim||claim.uid===user.uid,409,'That email cannot be used.');
    await tx.remove('email:'+hash(user.email));await tx.put('email:'+hash(pending.email),{uid:user.uid});await tx.put('user:'+user.uid,{...user,email:pending.email,epoch:user.epoch+1});await tx.put(key,{...pending,status:'claimed'});await security(tx,user.uid,'Email changed; all sessions invalidated');return {emailChanged:true};
   }
   const user=effectiveUser(await tx.get('user:'+pending.uid),now());requireThat(user&&user.status!=='deleted'&&(['login','entry'].includes(pending.purpose)?user.epoch===pending.epoch:user.status==='active'),403,'Account changed. Verify your email again.');
   await tx.put(key,{...pending,status:'claimed'});const family=await familyFor(tx,user,userAgent);return issue(tx,user,family,'account',config.origin);
  });
  return result;
 }
 async function acceptTerms(access,body){return atomic(store,async tx=>{const {user}=await authorize(tx,access,{allowRestricted:true});requireThat(body.accept===true&&body.version===currentTerms(),409,'The terms changed. Reload and review the current version.');if(needsTerms(user)){await tx.put('user:'+user.uid,{...user,termsAcceptedVersion:currentTerms(),termsAcceptedAt:now()});await security(tx,user.uid,'Terms accepted: '+currentTerms());}return {ok:true,version:currentTerms()};});}
 async function me(access){const {user,family}=await authenticate(access,{allowRestricted:true});return {...publicUser(user),deviceId:family.fid,csrf:csrf(family.fid)};}
 async function devices(access){const {user,family}=await authenticate(access,{allowRestricted:true});const rows=await Promise.all((user.devices||[]).map(fid=>store.get('family:'+fid)));return rows.filter(live).map(({fid,label,type,browser,os,firstSeen,lastActive,revoked})=>({id:fid,label,type,browser,os,firstSeen,lastActive,revoked,current:fid===family.fid}));}
 async function deviceAction(access,body){return atomic(store,async tx=>{
  const {user,family}=await authorize(tx,access,{allowRestricted:true});
  requireThat(['rename','revoke','others','logout'].includes(body.action),400,'Invalid device action.');
  const ids=body.action==='others'?(user.devices||[]).filter(id=>id!==family.fid):[body.action==='logout'?family.fid:body.id];
  for(const fid of ids){requireThat(user.devices.includes(fid),404,'Device not found.');const row=await tx.get('family:'+fid);requireThat(row?.uid===user.uid,404,'Device not found.');await tx.put('family:'+fid,body.action==='rename'?{...row,label:plain(body.label,60,'Device name')}:{...row,revoked:true,revokedAt:now()});}
  await security(tx,user.uid,body.action==='rename'?'Device renamed':'Device sessions revoked');return {ok:true};
 });}
 async function rename(access,name){const normalized=username(name);return atomic(store,async tx=>{
  const {user}=await authorize(tx,access);requireThat(!(user.disallowedUsernames||[]).includes(normalized),400,'Choose a different username. An administrator restricted that name.');if(user.username===normalized){requireThat(!user.usernameChangeRequired,400,'Choose a new username to continue.');return publicUser(user);}
  const claim=await tx.get('name:'+normalized);requireThat(!live(claim),409,'That username is unavailable.');
  await tx.remove('name:'+user.username);await tx.put('name:'+normalized,{uid:user.uid});await tx.put('user:'+user.uid,{...user,username:normalized,usernameChangeRequired:false,usernameChangeReason:null});await security(tx,user.uid,'Username changed');return publicUser({...user,username:normalized,usernameChangeRequired:false,usernameChangeReason:null});
 });}
 async function preferences(access,value,options){return atomic(store,async tx=>{
  const {user}=await authorize(tx,access,options),id='prefs:'+user.uid,row=await tx.get(id);
  if(value===undefined)return row?.value||{accentIntensity:55,reducedMotion:false,language:'en'};
  const cleaned=cleanPreferences(value);await tx.put(id,{uid:user.uid,value:{...row?.value,...cleaned}});return {...row?.value,...cleaned};
 });}
 async function createHandoff(access,origin,binding){
  requireThat(config.endpoints.includes(origin)&&isToken(binding),400,'Invalid handoff destination or browser binding.');
  const code=token();await atomic(store,async tx=>{
   const {user,family}=await authorize(tx,access),assignment=await tx.get('assignment:'+user.uid);
   requireTerms(user);
  if(user.usernameChangeRequired)throw new Problem(403,'Change your username to continue.','USERNAME_CHANGE_REQUIRED');
   requireThat(assignment?.origin===origin&&!(await tx.get('endpoint:'+hash(origin)))?.blocked,403,'Open your assigned Frost endpoint.');
   await tx.put('handoff:'+hash(code),{uid:user.uid,fid:family.fid,epoch:user.epoch,origin,binding:hash(binding),expires:now()+60,used:false});
  });return {code,expiresIn:60};
 }
 async function redeem(code,origin,binding){requireThat(isToken(code)&&isToken(binding)&&config.endpoints.includes(origin),400,'Invalid handoff.');return atomic(store,async tx=>{
  const id='handoff:'+hash(code),row=await tx.get(id);requireThat(live(row)&&!row.used&&row.origin===origin&&row.binding===hash(binding),401,'This handoff expired or was already used.');
  const user=effectiveUser(await tx.get('user:'+row.uid),now()),family=await tx.get('family:'+row.fid),assignment=await tx.get('assignment:'+row.uid);
  requireThat(!(await tx.get('endpoint:'+hash(origin)))?.blocked&&user?.status==='active'&&user.epoch===row.epoch&&live(family)&&!family.revoked&&assignment?.origin===origin,403,'Account, device or assignment is no longer active.');
  requireTerms(user);
  if(user.usernameChangeRequired)throw new Problem(403,'Change your username to continue.','USERNAME_CHANGE_REQUIRED');
  await tx.put(id,{...row,used:true});return issue(tx,user,family,'browse',origin);
 });}
 async function checkConnection({uid,fid,epoch},origin){return atomic(store,async tx=>{
  requireThat(typeof uid==='string'&&typeof fid==='string'&&Number.isInteger(epoch),401,'Invalid browsing session.');
  const user=effectiveUser(await tx.get('user:'+uid),now()),family=await tx.get('family:'+fid);
  if(user&&['banned','suspended'].includes(user.status))throw new Problem(403,'Visit the dispenser to review or appeal this restriction.','ACCOUNT_RESTRICTED');
  requireThat(user?.status==='active'&&live(family)&&family.uid===uid&&!family.revoked&&user.epoch===epoch&&family.epoch===epoch,401,'This device session is no longer active.');
  requireTerms(user);
  if(user.usernameChangeRequired)throw new Problem(403,'Change your username to continue.','USERNAME_CHANGE_REQUIRED');
  const assignment=await tx.get('assignment:'+uid),endpoint=await tx.get('endpoint:'+hash(origin));
  if(endpoint?.blocked||(config.assignedOnly&&assignment?.origin!==origin))throw new Problem(403,'Open your current link from the dispenser.','ASSIGNMENT_CHANGED');
  return {allowed:true};
 });}
 async function checkBrowsing(access,origin){const result=await authenticate(access,{scope:'browse',origin});const grant={uid:result.user.uid,fid:result.family.fid,epoch:result.session.epoch};await checkConnection(grant,origin);await recordOnline(store,grant,now()).catch(()=>{});const globalRefresh=await store.get('browser-refresh:all');return {...grant,username:result.user.username,expires:result.session.expires,refresh:{all:globalRefresh?.browserRefreshRevision||0,account:result.user.browserRefreshRevision||0}};}
 return {acceptTerms,store,config,now,live,rate,notice,security,authorize,authenticate,csrf,publicUser,register,available,verifiedEvent,registrationStatus,completeRegistration,startVerification,me,devices,deviceAction,rename,preferences,refresh,bootstrap,createHandoff,redeem,checkBrowsing,checkConnection};
}

