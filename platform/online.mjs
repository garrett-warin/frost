import {effectiveUser} from './restrictions.mjs';
import {atomic} from './store.mjs';
export function isOnline(user,at){
 user=effectiveUser(user,at);
 return user.status==='active'&&!user.usernameChangeRequired&&user.browserSeenEpoch===user.epoch&&Number.isFinite(user.browserSeenAt)&&user.browserSeenAt<=at&&at-user.browserSeenAt<75;
}
export async function recordOnline(store,grant,at){
 const current=effectiveUser(await store.get('user:'+grant.uid),at);
 if(!current||current.status!=='active'||current.epoch!==grant.epoch||isOnline(current,at)&&at-current.browserSeenAt<30)return;
 await atomic(store,async tx=>{
  const user=effectiveUser(await tx.get('user:'+grant.uid),at);
  if(!user||user.status!=='active'||user.epoch!==grant.epoch||user.browserSeenAt>=at||(isOnline(user,at)&&at-user.browserSeenAt<30))return;
  await tx.put('user:'+grant.uid,{...user,browserSeenAt:at,browserSeenEpoch:grant.epoch});
 });
}

                                                                                  
export async function onlineAdmins(store,at){
 const roster=await store.get('staff-roster');
 const ids=[...new Set([roster?.owner,...(roster?.admins||[])].filter(Boolean))];
 const members=await Promise.all(ids.map(async uid=>{
  const user=effectiveUser(await store.get('user:'+uid),at);
  if(!user)return null;
  const seen=await store.get('admin-presence:'+uid);
  const family=seen?await store.get('family:'+seen.fid):null;
  const consoleOnline=user.status==='active'&&!user.usernameChangeRequired&&seen?.epoch===user.epoch&&Number.isFinite(seen.at)&&seen.at<=at&&at-seen.at<75&&family?.uid===uid&&!family.revoked&&family.epoch===user.epoch&&(!family.expires||family.expires>at);
  const browsing=isOnline(user,at);
  return {uid,username:user.username,role:uid===roster.owner?'owner':roster.headAdmins?.includes(uid)?'head-admin':'admin',online:!!(consoleOnline||browsing),activity:consoleOnline?'Admin console':'Browsing',lastSeenAt:Math.max(consoleOnline?seen.at:0,browsing?user.browserSeenAt:0)};
 }));
 return {total:members.filter(Boolean).length,items:members.filter(m=>m?.online).map(({online,...member})=>member).sort((a,b)=>a.username.localeCompare(b.username))};
}
