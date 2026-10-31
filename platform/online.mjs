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
