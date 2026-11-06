import {createBrowsingHistory} from './browsing-history.mjs';
import {effectiveUser} from './restrictions.mjs';
import {randomUUID} from 'node:crypto';
import {atomic} from './store.mjs';
import {requireThat,plain,equal} from './security.mjs';
import {createControl} from './control.mjs';
import {createAnalytics} from './analytics.mjs';
import {readResponses} from './verification-responses.mjs';
export const staffKey='staff-roster';
export const staffRole=(roster,uid)=>roster?.owner===uid?'owner':roster?.admins?.includes(uid)?(roster?.headAdmins?.includes(uid)?'head-admin':'admin'):'member';
export function createStaff(accounts,{legacyAdmin}={}){
 const {store,now}=accounts;
 async function identity(access,tx){const {user}=await accounts.authorize(tx,access);const roster=await tx.get(staffKey);const role=staffRole(roster,user.uid);requireThat(role!=='member',403,'Administrator access required.');return {user,roster,role};}
 async function run(access,path,body={},csrf){
  const {user,roster,role}=await atomic(store,async tx=>{const id=await identity(access,tx);const auth=await accounts.authorize(tx,access);requireThat(equal(csrf,accounts.csrf(auth.family.fid)),403,'Refresh this page before continuing.');const key='admin-presence:'+id.user.uid,seen=await tx.get(key);if(!seen||seen.epoch!==id.user.epoch||seen.fid!==auth.family.fid||now()-seen.at>=30)await tx.put(key,{at:now(),epoch:id.user.epoch,fid:auth.family.fid,expires:now()+150});return id;});
  if(path==='/session')return {role,frostId:user.uid};
  if(path==='/staff'){
   requireThat(['owner','head-admin'].includes(role),403,'Owner or head admin access required.');
   return {items:await Promise.all([roster.owner,...(roster.admins||[])].map(async uid=>{const u=await store.get('user:'+uid);return {uid,username:u?.username||'Unavailable',role:staffRole(roster,uid)};}))};
  }
  if(path==='/staff/change')return atomic(store,async tx=>{
   const current=await identity(access,tx);requireThat(['owner','head-admin'].includes(current.role),403,'Owner or head admin access required.');
   requireThat(['add','remove','promote','demote'].includes(body.action)&&typeof body.uid==='string',400,'Choose an account and action.');
   requireThat(body.uid!==current.roster.owner,403,'The owner role cannot be removed here.');
   const targetRole=staffRole(current.roster,body.uid);
   requireThat(current.role==='owner'||(targetRole!=='head-admin'&&['add','remove'].includes(body.action)),403,'Only the owner can manage head admins.');
   const target=effectiveUser(await tx.get('user:'+body.uid),now());requireThat(target&&(['remove','demote'].includes(body.action)||target.status==='active'),404,'Active account not found.');
   const admins=new Set(current.roster.admins||[]),heads=new Set((current.roster.headAdmins||[]).filter(uid=>admins.has(uid)));if(body.action==='add')admins.add(body.uid);else if(body.action==='remove'){admins.delete(body.uid);heads.delete(body.uid);}else if(body.action==='promote'){admins.add(body.uid);heads.add(body.uid);}else heads.delete(body.uid);requireThat(admins.size<=25,409,'Administrator limit reached.');
   const reason=plain(body.reason,200,'Reason');await tx.put(staffKey,{...current.roster,admins:[...admins],headAdmins:[...heads].filter(uid=>admins.has(uid))});const id=randomUUID();await tx.put('audit:'+id,{kind:'audit',sort:now()+':'+id,id,actor:current.user.uid,actorUsername:current.user.username,action:'staff:'+body.action,target:body.uid,reason,at:now(),expires:now()+365*86400});return {ok:true};
  });
  const authorizeTarget=async(tx,targetUid,operation)=>{const current=await identity(access,tx),targetRole=staffRole(current.roster,targetUid);requireThat(targetRole!=='owner',403,'The owner account is protected.');requireThat(current.role==='owner'||targetRole==='member'||(current.role==='head-admin'&&targetRole==='admin'&&operation==='ban'),403,'You cannot perform this action on this administrator.');};
  const control=createControl(accounts,{actor:user.uid,authorizeTarget,authorizeActor:tx=>identity(access,tx)});
  if(path==='/tickets/reply'&&body.operation==='assign'){const ticket=await store.get('ticket:'+body.id);requireThat(ticket,404,'Request not found.');requireThat(ticket.uid!==roster.owner,403,'The owner account is protected.');requireThat(role==='owner'||!roster.admins.includes(ticket.uid),403,'Only the owner can manage another administrator.');}
  if(['/accounts/action','/accounts/assign'].includes(path)){
   requireThat(body.uid!==roster.owner,403,'The owner account is protected.');
   requireThat(role==='owner'||staffRole(roster,body.uid)==='member'||(role==='head-admin'&&staffRole(roster,body.uid)==='admin'&&path==='/accounts/action'&&body.action==='ban'),403,'You cannot perform this action on this administrator.');
  }
  if(['/templates/detail','/templates/list','/templates/reports','/templates/remove'].includes(path))requireThat(false,410,'New-tab customization has been removed.');
  if(path==='/dashboard')return createAnalytics(accounts).dashboard(body.range,body.timezone);
  if(path==='/accounts/history')return createBrowsingHistory(accounts).read(body,user.uid);
  if(path==='/accounts')return createAnalytics(accounts).listUsers(body);
  if(path==='/verification/responses')return readResponses(accounts);
  const routes={'/accounts/notify':'notify','/accounts/action':'user','/accounts/assign':'assign','/links':'links','/links/action':'link','/activity':'list','/tickets/reply':'ticket','/tickets/create':'ticket-create','/browsers/refresh':'refresh'};
  if(routes[path]){if(path==='/activity')requireThat(['audit','tickets'].includes(body.kind),400,'Invalid collection.');return control.admin(routes[path],body);}
  requireThat(['/announcement','/maintenance/publish','/note/publish','/publish','/device/ban','/device/unban','/device/status'].includes(path),404,'Unknown admin operation.');
  requireThat(legacyAdmin,503,'Announcement and browser controls are not connected.');
  const result=await legacyAdmin(path,body);requireThat(result?.statusCode===200,result?.statusCode||503,result?.data?.error||'Admin operation failed.');return result.data;
 }
 return {run};
}

