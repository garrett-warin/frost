import {showAdminNotifications,clearAdminNotifications} from './admin-notifications.mjs';
let notificationAccount=null;
let pending;
export function checkDevice() {
 if(pending)return pending;
 pending=(async()=>{
  const response=await fetch('/api/device',{cache:'no-store',signal:AbortSignal.timeout(6000)});
  const data=await response.json();
  if(data.redirect){
   clearAdminNotifications();notificationAccount=null;
   const config=await fetch('/api/config',{cache:'no-store',signal:AbortSignal.timeout(6000)}).then(r=>r.json());
   const destination=new URL(data.redirect);
   if(config.dispenserOrigin&&destination.origin===config.dispenserOrigin&&['/','/appeal'].includes(destination.pathname))location.replace(destination.href);
   throw new Error(data.error||'Return to the dispenser to continue.');
  }
  const noteAccount=response.ok&&!data.banned?data.account?.frostId:null;if(noteAccount!==notificationAccount){clearAdminNotifications();notificationAccount=noteAccount;}
  if(noteAccount)showAdminNotifications(data.adminNotifications||[],async id=>{const response=await fetch('/api/account/notification-read',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id})});if(!response.ok)throw Error('Could not dismiss. Try again.');});
  await supportNotification(response.ok&&!data.banned&&(data.supportUnclaimed===true||data.supportReply===true));
  await personalSupportNotification(response.ok&&!data.banned&&data.supportUnread===true);
  const identity=document.getElementById('account-identity');
  if(identity){
   const account=response.ok&&!data.banned?data.account:null;
   const valid=account&&typeof account.username==='string'&&typeof account.frostId==='string';
   identity.hidden=!valid;
   identity.textContent=valid?'@'+account.username+' · Grove ID: '+account.frostId:'';
  }
  const badge=document.getElementById('device-code');
  if(badge && data.device){badge.textContent='Device: '+data.device;badge.title='This browser’s device code. Share it with the Grove owner when needed.';}
  let blocked=document.getElementById('device-blocked');
  if(data.banned){
   if(!blocked){
    blocked=document.createElement('section');blocked.id='device-blocked';
    const title=document.createElement('h1');title.textContent='This browser is banned from Grove.';
    const message=document.createElement('p');message.textContent='Contact the Grove owner and include this device code:';
    const code=document.createElement('code');code.textContent=data.device;
    const retry=document.createElement('button');retry.textContent='Check again';retry.onclick=()=>void checkDevice().catch(()=>{});
    blocked.append(title,message,code,retry);document.body.append(blocked);
   }
   throw new Error('This browser is banned from Grove. Device: '+data.device);
  }
  if(!response.ok)throw new Error(data.error||'Device access check failed.');
  blocked?.remove();
  return data;
 })().catch(error=>{clearAdminNotifications();notificationAccount=null;document.getElementById('admin-support-notification')?.remove();document.getElementById('support-reply-notification')?.remove();throw error;}).finally(()=>{pending=undefined;});
 return pending;
}

async function supportNotification(show){
 let badge=document.getElementById('admin-support-notification');if(!show){badge?.remove();return;}if(badge)return;
 try{const response=await fetch('/api/config',{cache:'no-store',signal:AbortSignal.timeout(6000)});if(!response.ok)return;const config=await response.json();const origin=new URL(config.dispenserOrigin);if(origin.protocol!=='https:'||origin.origin!==config.dispenserOrigin)return;
 badge=document.createElement('a');badge.id='admin-support-notification';badge.className='admin-support-notification';badge.href=origin.origin+'/admin#support';badge.target='_blank';badge.rel='noopener';badge.textContent='Support needs your attention →';badge.setAttribute('aria-label','Support requests or replies. Open the admin support queue');document.body.append(badge);
 }catch{badge?.remove();}
}

async function personalSupportNotification(show){
 let badge=document.getElementById('support-reply-notification');if(!show){badge?.remove();return;}if(badge)return;
 try{const response=await fetch('/api/config',{cache:'no-store',signal:AbortSignal.timeout(6000)});if(!response.ok)return;const config=await response.json();const origin=new URL(config.dispenserOrigin);if(origin.protocol!=='https:'||origin.origin!==config.dispenserOrigin)return;
 badge=document.createElement('a');badge.id='support-reply-notification';badge.className='admin-support-notification support-reply-notification';badge.href=origin.origin+'/#support';badge.target='_blank';badge.rel='noopener';badge.textContent='You have a new support message →';badge.setAttribute('aria-label','New support message. Open your support conversations');document.body.append(badge);
 }catch{badge?.remove();}
}
