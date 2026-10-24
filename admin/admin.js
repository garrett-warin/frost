const $=id=>document.getElementById(id);
let session='',setup=new URLSearchParams(location.hash.slice(1)).get('setup')||'',expiry;
history.replaceState(null,'',location.pathname);
async function api(path,body={}){
 const payload=JSON.stringify(body);
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(payload)))).map(x=>x.toString(16).padStart(2,'0')).join('');
 const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-Amz-Content-Sha256':hash,...(session?{'X-Frost-Session':session}:{}),...(setup?{'X-Frost-Setup':setup}:{})},body:payload});
 const data=await response.json(); if(!response.ok)throw new Error(data.error||'Request failed.'); return data;
}
function lock(){session='';clearTimeout(expiry);$('editor').hidden=true;$('devices').hidden=true;$('device-id').value='';$('ban-reason').value='';$('ban-status').textContent='';$('login').hidden=false;$('code').value='';}
async function run(fn){for(const b of document.querySelectorAll('button'))b.disabled=true;try{await fn();}catch(error){$('notice').textContent=error.message;}finally{for(const b of document.querySelectorAll('button'))b.disabled=false;}}
if(setup)void run(async()=>{const data=await api('/setup/start');$('qr').src=data.qr;$('secret').textContent=data.secret;$('enrollment').hidden=false;});
$('login').onsubmit=event=>{event.preventDefault();void run(async()=>{const data=await api(setup?'/setup/confirm':'/login',{code:$('code').value});session=data.session;setup='';$('secret').textContent='';$('qr').removeAttribute('src');$('enrollment').hidden=true;$('code').value='';$('login').hidden=true;$('editor').hidden=false;const response=await fetch('/announcement',{cache:'no-store'});$('message').value=(await response.json()).message;$('notice').textContent='Console unlocked.';expiry=setTimeout(()=>{lock();$('notice').textContent='Session expired. Enter a fresh code.';},data.expiresIn*1000);});};
$('editor').onsubmit=event=>{event.preventDefault();void run(async()=>{await api('/publish',{message:$('message').value});$('notice').textContent='Announcement published.';});};
$('remove').onclick=()=>void run(async()=>{await api('/publish',{message:''});$('message').value='';$('notice').textContent='Banner removed.';});
$('logout').onclick=()=>void run(async()=>{try { await api('/logout'); } finally { lock(); $('notice').textContent='Console locked.'; }});
new MutationObserver(()=>{$('devices').hidden=$('editor').hidden;}).observe($('editor'),{attributes:true,attributeFilter:['hidden']});
async function deviceAction(action){
 const device=$('device-id').value.trim().toLowerCase();
 if(action==='ban'&&!confirm('Ban browser '+device+'? Active browsing connections will be disconnected within about 30 seconds.'))return;
 const result=await api('/device/'+action,{device,reason:$('ban-reason').value});
 $('ban-status').textContent=device+': '+(result.banned?'Banned.':'Not banned.');
 $('ban-reason').value=result.reason;
}
$('device-form').onsubmit=event=>{event.preventDefault();void run(()=>deviceAction('status'));};
$('ban-device').onclick=()=>void run(()=>deviceAction('ban'));
$('unban-device').onclick=()=>void run(()=>deviceAction('unban'));

