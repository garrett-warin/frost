import {createBrowsingHistory} from './browsing-history.mjs';
import {createDesigns} from './designs.mjs';
import {effectiveUser} from './restrictions.mjs';
import {randomUUID} from 'node:crypto';
import {atomic} from './store.mjs';
import {requireThat,plain,equal} from './security.mjs';
import {createControl} from './control.mjs';
import {createAnalytics} from './analytics.mjs';
import {readResponses} from './verification-responses.mjs';
export const staffKey='staff-roster';
export const staffRole=(roster,uid)=>roster?.owner===uid?'owner':roster?.admins?.includes(uid)?'admin':'member';
export function createStaff(accounts,{legacyAdmin}={}){
 const {store,now}=accounts;
 async function identity(access,tx){const {user}=await accounts.authorize(tx,access);const roster=await tx.get(staffKey);const role=staffRole(roster,user.uid);requireThat(role!=='member',403,'Administrator access required.');return {user,roster,role};}
 async function run(access,path,body={},csrf){
  const {user,roster,role}=await atomic(store,async tx=>{const id=await identity(access,tx);const auth=await accounts.authorize(tx,access);requireThat(equal(csrf,accounts.csrf(auth.family.fid)),403,'Refresh this page before continuing.');return id;});
  if(path==='/session')return {role,frostId:user.uid};
  if(path==='/staff'){
   requireThat(role==='owner',403,'Only the owner can manage administrators.');
   return {items:await Promise.all([roster.owner,...(roster.admins||[])].map(async uid=>{const u=await store.get('user:'+uid);return {uid,username:u?.username||'Unavailable',role:staffRole(roster,uid)};}))};
  }
  if(path==='/staff/change')return atomic(store,async tx=>{
   const current=await identity(access,tx);requireThat(current.role==='owner',403,'Only the owner can manage administrators.');
   requireThat(['add','remove'].includes(body.action)&&typeof body.uid==='string',400,'Choose an account and action.');
   requireThat(body.uid!==current.roster.owner,403,'The owner role cannot be removed here.');
   const target=effectiveUser(await tx.get('user:'+body.uid),now());requireThat(target&&(body.action==='remove'||target.status==='active'),404,'Active account not found.');
   const admins=new Set(current.roster.admins||[]);if(body.action==='add')admins.add(body.uid);else admins.delete(body.uid);requireThat(admins.size<=25,409,'Administrator limit reached.');
   const reason=plain(body.reason,200,'Reason');await tx.put(staffKey,{...current.roster,admins:[...admins]});const id=randomUUID();await tx.put('audit:'+id,{kind:'audit',sort:now()+':'+id,id,actor:current.user.uid,action:'staff:'+body.action,target:body.uid,reason,at:now(),expires:now()+365*86400});return {ok:true};
  });
  const control=createControl(accounts,{actor:user.uid});
  if(['/accounts/action','/accounts/assign'].includes(path)){
   requireThat(body.uid!==roster.owner,403,'The owner account is protected.');
   requireThat(role==='owner'||!roster.admins.includes(body.uid),403,'Only the owner can manage another administrator.');
  }
  if(['/templates/detail','/templates/list','/templates/reports','/templates/remove'].includes(path))return createDesigns(accounts).admin(path.split('/').pop(),body,user.uid);
  if(path==='/dashboard')return createAnalytics(accounts).dashboard(body.range,body.timezone);
  if(path==='/accounts/history')return createBrowsingHistory(accounts).read(body,user.uid);
  if(path==='/accounts')return createAnalytics(accounts).listUsers(body);
  if(path==='/verification/responses')return readResponses(accounts);
  const routes={'/accounts/action':'user','/accounts/assign':'assign','/links':'links','/links/action':'link','/activity':'list','/tickets/reply':'ticket','/browsers/refresh':'refresh'};
  if(routes[path]){if(path==='/activity')requireThat(['audit','tickets'].includes(body.kind),400,'Invalid collection.');return control.admin(routes[path],body);}
  requireThat(['/announcement','/maintenance/publish','/note/publish','/publish','/device/ban','/device/unban','/device/status'].includes(path),404,'Unknown admin operation.');
  requireThat(legacyAdmin,503,'Announcement and browser controls are not connected.');
  const result=await legacyAdmin(path,body);requireThat(result?.statusCode===200,result?.statusCode||503,result?.data?.error||'Admin operation failed.');return result.data;
 }
 return {run};
}

