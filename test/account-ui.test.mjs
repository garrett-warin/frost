import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../platform/ui/account.mjs',import.meta.url),'utf8');
function ui(){
 const elements=new Map(),timers=new Map();let timer=0;
 const get=id=>{if(!elements.has(id))elements.set(id,{hidden:false,textContent:'',value:'',dataset:{},listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},focus(){this.focused=true;},select(){},querySelector(){return {disabled:false};}});return elements.get(id);};
 const context=vm.createContext({document:{getElementById:get},window:{addEventListener(){}},location:{pathname:'/',search:''},URL,URLSearchParams,TextEncoder,crypto:globalThis.crypto,navigator:{clipboard:{writeText:async()=>{}}},fetch:async()=>({ok:true,status:200,json:async()=>({status:'pending'})}),setTimeout(fn){timers.set(++timer,fn);return timer;},clearTimeout(id){timers.delete(id);},console,setInterval(){},showAdminNotifications(){},clearAdminNotifications(){}});
 vm.runInContext(source.replace(/^import .*;$/mg,'').replace(/^start\(\);$/mg,''),context);
 return {get,timers,run:code=>vm.runInContext(code,context),context};
}
test('one email entry becomes verification, then a new user gets only the username step',async()=>{
 const u=ui();u.run('showAuth()');assert.equal(u.get('signin').hidden,false);assert.equal(u.get('profile').hidden,true);
 await u.run('beginVerification({siteCode:"preview",formUrl:"https://docs.google.com/forms/example",expiresIn:900},"preview@example.com")');
 assert.equal(u.get('signin').hidden,true);assert.equal(u.get('verification').hidden,false);
 await u.get('copy-code').listeners.click();await u.run('poll()');assert.match(u.get('copy-feedback').textContent,/Copied/);
 u.context.fetch=async()=>({ok:true,status:200,json:async()=>({status:'needs_username'})});await u.run('poll()');
 assert.equal(u.get('verification').hidden,true);assert.equal(u.get('profile').hidden,false);assert.equal(u.timers.size,0);
 await u.get('profile-back').listeners.click();assert.equal(u.get('profile').hidden,true);assert.equal(u.get('signin').hidden,false);
});
test('mismatched email stays actionable and clears after a successful resubmission',async()=>{
 const u=ui();u.context.fetch=async()=>({ok:true,status:200,json:async()=>({status:'pending',errorCode:'EMAIL_MISMATCH'})});
 await u.run('beginVerification({siteCode:"preview",formUrl:"https://docs.google.com/forms/example",expiresIn:900},"preview@example.com")');
 assert.match(u.get('status').textContent,/does not match/);assert.equal(u.get('verification').hidden,false);
 await u.get('check-verification').listeners.click();assert.match(u.get('status').textContent,/does not match/);
 u.context.fetch=async()=>({ok:true,status:200,json:async()=>({status:'needs_username'})});await u.run('poll()');
 assert.equal(u.get('status').textContent,'');assert.equal(u.get('profile').hidden,false);
});

test('late verification responses cannot replace entry; expired codes stop polling',async()=>{
 const u=ui();let resolve;u.context.fetch=()=>new Promise(r=>{resolve=r;});
 const pending=u.run('beginVerification({siteCode:"preview",formUrl:"https://docs.google.com/forms/example",expiresIn:900},"preview@example.com")');
 u.run('showAuth()');resolve({ok:true,status:200,json:async()=>({status:'needs_username'})});await pending;
 assert.equal(u.get('signin').hidden,false);assert.equal(u.get('profile').hidden,true);
 u.context.fetch=async()=>({ok:false,status:410,json:async()=>({error:'Registration expired.'})});
 await u.run('beginVerification({siteCode:"preview",formUrl:"https://docs.google.com/forms/example",expiresIn:900},"preview@example.com")');
 assert.equal(u.get('check-verification').hidden,true);assert.equal(u.timers.size,0);assert.match(u.get('status').textContent,/no longer active/);
});
test('retry countdown disables resubmission and restores the original button at expiry',()=>{
 const u=ui();let now=1000;u.context.Date={now:()=>now};const button=u.get('retry-test');button.textContent='Create account';
 u.run('cooldown(document.getElementById("retry-test"),61)');assert.equal(button.disabled,true);assert.equal(button.textContent,'Try again in 1:01');
 now+=61000;const tick=[...u.timers.values()][0];tick();assert.equal(button.disabled,false);assert.equal(button.textContent,'Create account');
});

test('unassigned account accepts null assignment without reading csrf or showing login',async()=>{
 const u=ui();u.context.fetch=async()=>({ok:true,status:200,json:async()=>null});
 u.run("user={status:'active'};document.getElementById('signin').hidden=true");
 assert.equal(await u.run("api('/api/assignment')"),null);
 await u.run('loadAssignment()');assert.equal(u.get('endpoint').textContent,'No link is available right now. Please check back shortly.');assert.equal(u.get('open-frost').disabled,true);assert.equal(u.get('signin').hidden,true);
});

test('page reload restores a saved login even after a mirror verify redirect, without rotating it',async()=>{
 for(const search of ['', '?verify=1']){
  const u=ui(),calls=[];u.context.location.search=search;
  u.context.fetch=async path=>{calls.push(path);return {ok:true,status:200,json:async()=>({signedIn:true,csrf:'saved',registrationReady:true})};};
  u.run('signedIn=async()=>{globalThis.restored=true;}');
  await u.run('start()');
  assert.equal(u.context.restored,true);assert.deepEqual(calls,['/api/bootstrap']);
 }
});

test('concurrent expired requests share one renewal and retry with the saved session',async()=>{
 const u=ui();let renewed=false,rotations=0;
 u.run("csrf='saved'");
 u.context.fetch=async path=>{
  if(path==='/api/refresh'){rotations++;await new Promise(resolve=>setImmediate(resolve));renewed=true;return {ok:true,status:200,json:async()=>({csrf:'saved'})};}
  return {ok:renewed,status:renewed?200:401,json:async()=>renewed?{csrf:'saved'}:{error:'Expired'}};
 };
 await Promise.all([u.run("api('/api/me')"),u.run("api('/api/devices')")]);
 assert.equal(rotations,1);
});

test('cross-tab lock rechecks cookies before rotating and a refresh conflict can recover',async()=>{
 const u=ui();let rotations=0,checks=0,locks=0;
 u.context.navigator.locks={request:async(name,run)=>{assert.equal(name,'frost-account-refresh');locks++;return run();}};
 u.context.setTimeout=fn=>{fn();return 1;};
 u.context.fetch=async path=>{
  if(path==='/api/refresh'){rotations++;return {ok:false,status:409,json:async()=>({error:'Another tab refreshed'})};}
  checks++;return {ok:checks>1,status:checks>1?200:401,json:async()=>({csrf:'saved'})};
 };
 await u.run('restoreSession()');assert.equal(rotations,1);assert.equal(locks,1);
 await u.run('restoreSession()');assert.equal(rotations,1);
});

test('revoked sessions still require verification and service outages do not redirect',async()=>{
 for(const status of [401,503]){
  const u=ui(),redirects=[];u.context.location.replace=url=>redirects.push(url);
  u.context.fetch=async path=>({ok:false,status:path==='/api/me'?401:status,json:async()=>({error:'Unavailable'})});
  await assert.rejects(u.run('restoreSession()'));
  assert.deepEqual(redirects,status===401?['/?verify=1']:[]);
 }
});

test('restriction page distinguishes timed suspension, permanent ban and recovered account',()=>{
 const u=ui(),links=[{hash:'#home'},{hash:'#settings'},{hash:'#support'}];
 u.context.document.querySelectorAll=()=>links;
 u.run("renderRestriction({accountStatus:'suspended',reason:'A test reason',until:1700003600,serverTime:1700000000})");
 assert.equal(u.get('restriction').hidden,false);assert.match(u.get('restriction-title').textContent,/paused/);
 assert.equal(u.get('restriction-remaining').textContent,'1h 0m remaining');assert.equal(links[0].hidden,true);
 assert.equal(u.get('restriction-reason').textContent,'A test reason');assert.equal(u.timers.size,1);
 u.run("renderRestriction({accountStatus:'banned',reason:'New ban'})");
 assert.match(u.get('restriction-title').textContent,/banned/);assert.equal(u.get('restriction-until').textContent,'Indefinite');assert.equal(u.timers.size,0);
 u.run("renderRestriction({accountStatus:'active'})");
 assert.equal(u.get('restriction').hidden,true);assert.equal(links[0].hidden,false);assert.equal(links[1].hidden,false);
});
