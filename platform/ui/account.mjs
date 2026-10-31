const $=id=>document.getElementById(id),status=$('status');let csrf='',user,assignment,pollTimer,pollDeadline=0,verificationEpoch=0,checking=false;
const accountOptions=()=>new URLSearchParams(location.search).has('account-options');
const cursors={};let restrictionTimer;

async function checkRestriction(){
 if(!user||$('account').hidden)return;
 try{const next=await api('/api/restriction');if($('account').hidden)return;if(next.accountStatus==='active')await signedIn();else renderRestriction(next);}
 catch(error){message(error.message,true);if(!$('account').hidden)restrictionTimer=setTimeout(checkRestriction,60000);}
}
function renderRestriction(restriction){
 clearTimeout(restrictionTimer);
 const suspended=restriction.accountStatus==='suspended',restricted=['banned','suspended'].includes(restriction.accountStatus);
 $('restriction').hidden=!restricted;
 document.querySelectorAll('nav a').forEach(link=>{if(['#home','#settings'].includes(link.hash))link.hidden=restricted;});
 if(!restricted)return;
 $('restriction-label').textContent=suspended?'TEMPORARY RESTRICTION':'ACCOUNT BANNED';
 $('restriction-title').textContent=suspended?'Your browsing access is paused.':'Your account has been banned.';
 $('restriction-summary').textContent=suspended?(Number.isFinite(restriction.until)&&restriction.until>0?'Your suspension ends automatically. You can appeal while you wait.':'Your access is paused until an administrator reviews it. You can send an appeal below.'):'Browsing is unavailable on this account. You can ask an administrator to review this decision.';
 $('restriction-reason').textContent=restriction.reason||'No reason was provided. You can request details in your appeal.';
 const until=suspended&&Number.isFinite(restriction.until)?restriction.until:null;
 $('restriction-time-label').textContent=until?'Access returns':'Duration';
 $('restriction-until').textContent=until?new Date(until*1000).toLocaleString([],{dateStyle:'medium',timeStyle:'short'}):suspended?'Until an administrator restores access':'Indefinite';
 $('restriction-until').dateTime=until?new Date(until*1000).toISOString():'';
 const remaining=until?Math.max(0,Math.ceil((until-(restriction.serverTime||Date.now()/1000))/60)):0;
 $('restriction-remaining').textContent=until?(remaining>=1440?Math.floor(remaining/1440)+'d '+Math.floor(remaining%1440/60)+'h remaining':remaining>=60?Math.floor(remaining/60)+'h '+remaining%60+'m remaining':remaining>0?remaining+'m remaining':'Checking access…'):'';
 if(until)restrictionTimer=setTimeout(checkRestriction,Math.max(1000,Math.min(60000,(until-(restriction.serverTime||Date.now()/1000))*1000)));
}

let sessionRefresh;
function restoreSession(){
 if(sessionRefresh)return sessionRefresh;
 const renew=async()=>{
  // Another tab may already have renewed the shared HttpOnly cookies.
  for(let attempt=0;attempt<4;attempt++){
   const response=await fetch('/api/me',{credentials:'same-origin',cache:'no-store'});
   if(response.ok){const data=await response.json();if(data?.csrf)csrf=data.csrf;return;}
   if(response.status!==401)throw new Error('Could not restore your session. Try again shortly.');
   try{await api('/api/refresh',{},false);return;}catch(error){
    if(error.status!==409||attempt===3)throw error;
    await new Promise(resolve=>setTimeout(resolve,300));
   }
  }
 };
 sessionRefresh=(navigator.locks?navigator.locks.request('frost-account-refresh',renew):renew()).finally(()=>{sessionRefresh=undefined;});
 return sessionRefresh;
}
function message(text,error=false){status.textContent=text;status.dataset.error=String(error);}
function node(tag,text,className){const element=document.createElement(tag);if(text!==undefined)element.textContent=text;if(className)element.className=className;return element;}
async function digest(text){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(n=>n.toString(16).padStart(2,'0')).join('');}
async function api(path,value,retry=true){
 const headers={};let body;if(value!==undefined){body=JSON.stringify(value);headers['Content-Type']='application/json';headers['X-Frost-Csrf']=csrf;headers['X-Amz-Content-Sha256']=await digest(body);}
 const response=await fetch(path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers,body}),data=await response.json();
 if(response.status===401&&retry&&csrf&&path!=='/api/refresh'){await restoreSession();return api(path,value,false);}
 if(response.status===401&&(!retry||path==='/api/refresh')){location.replace('/?verify=1');throw new Error('Verify your email again to continue.');}
 if(!response.ok){const error=new Error(data?.error||'Could not finish that request.');error.status=response.status;if(Number.isInteger(data?.retryAfter)&&data.retryAfter>0&&data.retryAfter<=3600)error.retryAfter=data.retryAfter;throw error;}if(data?.csrf)csrf=data.csrf;return data;
}
function action(id,run){$(id).addEventListener('click',async()=>{const button=$(id);button.disabled=true;try{await run();}catch(error){message(error.message,true);}finally{button.disabled=false;}});}
function cooldown(button,seconds){
 const label=button.textContent,until=Date.now()+seconds*1000;
 function tick(){const left=Math.max(0,Math.ceil((until-Date.now())/1000));button.disabled=left>0;button.textContent=left?'Try again in '+Math.floor(left/60)+':'+String(left%60).padStart(2,'0'):label;if(left)setTimeout(tick,1000);}
 tick();
}
function form(id,run){$(id).addEventListener('submit',async event=>{event.preventDefault();const button=event.currentTarget.querySelector('button');if(button.disabled)return;button.disabled=true;let wait=0;try{await run(Object.fromEntries(new FormData(event.currentTarget)));}catch(error){message(error.message,true);wait=error.retryAfter||0;}finally{if(wait)cooldown(button,wait);else button.disabled=false;}});}
function showPage(){if(user?.usernameChangeRequired&&user.status==='active'&&!accountOptions())return;let page=location.pathname==='/appeal'&&!location.hash?'support':location.hash.slice(1)||'home';if(user&&user.status!=='active'&&['home','settings'].includes(page))page='support';document.querySelectorAll('[data-page]').forEach(section=>section.hidden=section.dataset.page!==page);document.querySelectorAll('nav a').forEach(link=>{if(link.hash==='#'+page)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});if(page==='support')list('tickets','/api/support');if(page==='activity'){list('notifications','/api/notifications');list('security','/api/security');}}
window.addEventListener('hashchange',showPage);
async function list(id,path,append=false){try{const data=await api(path+(append&&cursors[id]?'?cursor='+encodeURIComponent(cursors[id]):''));if(!append)$(id).replaceChildren();if(!data.items.length&&!append)$(id).append(node('p','Nothing here yet.','note'));for(const row of data.items){const item=node('article',undefined,'row');item.append(node('h3',row.subject||row.action||row.type||'Update'));item.append(node('p',row.message||row.status||''));for(const reply of row.replies||[])item.append(node('p','Administrator: '+reply.message));const at=row.createdAt||row.at;if(at)item.append(node('p',new Date(at*1000).toLocaleString(),'note'));$(id).append(item);}cursors[id]=data.cursor;$('more-'+id).hidden=!data.cursor;}catch(error){message(error.message,true);}}
for(const [id,path] of [['tickets','/api/support'],['notifications','/api/notifications'],['security','/api/security']])action('more-'+id,()=>list(id,path,true));
async function loadAssignment(){assignment=await api('/api/assignment');$('endpoint').textContent=assignment?assignment.origin+' · '+assignment.status:'No link is available right now. Please check back shortly.';$('open-frost').disabled=user.terms?.required||user.status!=='active'||!assignment||assignment.status==='blocked';}
async function loadDevices(){const devices=await api('/api/devices');$('devices').replaceChildren();for(const device of devices){const row=node('article',undefined,'row');row.append(node('h3',device.label+(device.current?' · this device':'')),node('p',device.browser+' / '+device.os+' · '+(device.revoked?'signed out':'last active '+new Date(device.lastActive*1000).toLocaleString()),'note'));if(!device.revoked){const controls=node('div',undefined,'actions'),name=node('input');name.value=device.label;name.maxLength=60;name.setAttribute('aria-label','Device name');const rename=node('button','Rename'),revoke=node('button',device.current?'Sign out':'Revoke');rename.addEventListener('click',async()=>{try{await api('/api/devices',{action:'rename',id:device.id,label:name.value});await loadDevices();message('Device renamed.');}catch(error){message(error.message,true);}});revoke.addEventListener('click',async()=>{try{await api('/api/devices',{action:device.current?'logout':'revoke',id:device.id});if(device.current)location.replace('/');else await loadDevices();}catch(error){message(error.message,true);}});controls.append(name,rename,revoke);row.append(controls);}$('devices').append(row);}}
async function signedIn(){const cleanUrl=new URL(location.href);cleanUrl.searchParams.delete('verify');history.replaceState(null,'',cleanUrl.pathname+cleanUrl.search+cleanUrl.hash);user=await api('/api/me');$('terms-gate').hidden=true;$('terms-review-link').hidden=!user.terms?.required||!accountOptions();$('signin').hidden=true;$('profile').hidden=true;$('verification').hidden=true;if(user.terms?.required&&user.status==='active'&&!new URLSearchParams(location.search).has('account-options')){$('account').hidden=true;$('required-rename').hidden=true;$('terms-gate').hidden=false;$('accept-terms').reset();$('terms-heading').focus();message('Review the updated terms to continue browsing.');return;}$('required-rename').hidden=!(user.usernameChangeRequired&&user.status==='active'&&!accountOptions());$('account').hidden=!!(user.usernameChangeRequired&&user.status==='active'&&!accountOptions());if(user.usernameChangeRequired&&user.status==='active'&&!accountOptions()){$('required-rename-reason').textContent=user.usernameChangeReason||'Please choose a different username.';message('Update your username to continue.');return;}if($('admin-link'))$('admin-link').hidden=!['owner','admin'].includes(user.role);$('greeting').textContent='hey, '+user.username+'.';$('frost-id').textContent='@'+user.username+' · Frost ID / '+user.frostId;$('email').textContent=user.email;$('rename').elements.username.value=user.username;const restriction=await api('/api/restriction');user.status=restriction.accountStatus||user.status;renderRestriction(restriction);if(user.status!=='active')$('support').elements.type.value='appeal';await loadAssignment();await loadDevices();if(user.status==='active'){const prefs=await api('/api/preferences');$('preferences').elements.accentIntensity.value=prefs.accentIntensity;$('preferences').elements.reducedMotion.checked=prefs.reducedMotion;}showPage();message('You’re signed in.');
 const pending=sessionStorage.getItem('frost.pending-handoff');if(pending&&user.status==='active'&&!user.terms?.required){const request=JSON.parse(pending);sessionStorage.removeItem('frost.pending-handoff');const result=await api('/api/handoff',request);location.replace(result.url);}
}
function showAuth(focus=true){
 $('terms-gate').hidden=true;
 verificationEpoch++;clearTimeout(pollTimer);clearTimeout(restrictionTimer);checking=false;
 $('required-rename').hidden=true;$('verification').hidden=true;$('profile').hidden=true;$('account').hidden=true;$('signin').hidden=false;
 if(focus)$('auth-title').focus();
}
function showProfile(){
 clearTimeout(pollTimer);$('verification').hidden=true;$('signin').hidden=true;$('profile').hidden=false;message('');$('profile-title').focus();
}
function beginVerification(result,email){
 verificationEpoch++;clearTimeout(pollTimer);checking=false;
 $('site-code').value=result.siteCode;$('verify-link').href=result.formUrl;
 $('verification-email').textContent=email;$('copy-feedback').textContent='';$('copy-code').textContent='Copy code';
 $('signin').hidden=true;$('profile').hidden=true;$('account').hidden=true;$('verification').hidden=false;
 $('check-verification').hidden=false;$('verification-back').textContent=user?'Back to account':'Use a different email';
 pollDeadline=Date.now()+result.expiresIn*1000;message('');$('verification-title').focus();return poll();
}
async function poll(){
 if(checking||$('verification').hidden)return;
 clearTimeout(pollTimer);const epoch=verificationEpoch;checking=true;
 try{
  if(Date.now()>pollDeadline){$('check-verification').hidden=true;message('This code has expired. Go back and request a new one.',true);return;}
  const result=await api('/api/register/status');if(epoch!==verificationEpoch)return;
  if(result.status==='needs_username'){showProfile();return;}
  if(result.status==='verified'){
   const completed=await api('/api/register/complete',{});if(epoch!==verificationEpoch)return;
   $('verification').hidden=true;if(completed.emailChanged){location.replace('/?verify=1');return;}await signedIn();return;
  }
  if(result.status==='existing'||result.status==='missing'){showAuth();message('Please enter your email to continue.',true);return;}
  if(result.status==='expired'){ $('check-verification').hidden=true;message('This code has expired. Go back and request a new one.',true);return; }
  pollTimer=setTimeout(poll,5000);
 }catch(error){if(epoch===verificationEpoch){message([401,410].includes(error.status)?'This code is no longer active. Go back and request a new one.':error.message,true);if([401,410].includes(error.status))$('check-verification').hidden=true;else pollTimer=setTimeout(poll,5000);}}
 finally{if(epoch===verificationEpoch)checking=false;}
}
form('login',async body=>beginVerification(await api('/api/entry',body),body.email));
form('finish-profile',async body=>{await api('/api/register/complete',body);await signedIn();});
action('profile-back',()=>{showAuth();message('');});
action('verification-back',async()=>{verificationEpoch++;clearTimeout(pollTimer);checking=false;$('verification').hidden=true;if(user)await signedIn();else{showAuth();message('');}});
action('check-verification',async()=>{message('Checking your form submission…');await poll();if(!$('verification').hidden&&status.dataset.error!=='true')message('Not received yet. Submit the Google Form, then come back here.');});
action('copy-code',async()=>{try{await navigator.clipboard.writeText($('site-code').value);$('copy-code').textContent='Copied';$('copy-feedback').textContent='Copied. Now open the Google Form below.';}catch{$('site-code').focus();$('site-code').select();$('copy-feedback').textContent='Copy the selected code, then open the Google Form.'}});
action('logout',async()=>{await api('/api/devices',{action:'logout'});sessionStorage.removeItem('frost.pending-handoff');location.replace('/');});
action('refresh-link',loadAssignment);action('open-frost',async()=>{await loadAssignment();if(!assignment)throw Error('No link is available right now. Please check back shortly.');location.assign(assignment.origin+'/auth/start');});
form('report',async body=>{const result=await api('/api/reports',body);message(result.message);});
form('support',async body=>{await api('/api/support',body);$('support').reset();message('Sent privately. Replies will appear here.');await list('tickets','/api/support');});
form('rename',async body=>{await api('/api/username',body);await signedIn();message('Username saved. Your Frost ID stays the same.');});
form('preferences',async body=>{await api('/api/preferences',{accentIntensity:Number(body.accentIntensity),reducedMotion:body.reducedMotion==='on'});message('Preferences saved.');});
action('revoke-others',async()=>{await api('/api/devices',{action:'others'});await loadDevices();message('Other devices signed out.');});
form('change-email',async body=>beginVerification(await api('/api/email',body),body.email));
action('delete-account',async()=>{if($('delete-confirm').value!=='DELETE')throw new Error('Type DELETE to confirm account deletion.');await api('/api/delete',{});location.replace('/');});
async function start(){try{if(location.pathname==='/open'){const params=new URLSearchParams(location.search),origin=params.get('origin'),binding=params.get('binding');if(origin&&/^https:\/\/[a-z0-9.-]+$/.test(origin)&&/^[A-Za-z0-9_-]{43}$/.test(binding||''))sessionStorage.setItem('frost.pending-handoff',JSON.stringify({origin,binding}));history.replaceState(null,'','/open');}const boot=await api('/api/bootstrap');csrf=boot.csrf||'';if(boot.signedIn){await signedIn();}else{showAuth(false);if(!boot.registrationReady){$('login').hidden=true;$('auth-help').hidden=true;}message(boot.registrationReady?'':'Email verification is being set up. Please check back soon.');}}catch(error){message(error.message,true);$('signin').hidden=!!user;}}

action('restriction-recheck',async()=>{await signedIn();message(user.status==='active'?'Access restored. Open Frost from Your link.':'This restriction is still active.');});
form('required-rename-form',async value=>{await api('/api/username',value);await signedIn();});

form('accept-terms',async body=>{if(body.agree!=='on')throw Error('Please read and agree before continuing.');await api('/api/terms/accept',{accept:true,version:user.terms.version});await signedIn();});
action('terms-decline',()=>{location.assign('/?account-options=1#support');});
start();
