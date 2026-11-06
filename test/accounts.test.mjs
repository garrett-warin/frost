import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccounts} from '../platform/accounts.mjs';
import {createControl} from '../platform/control.mjs';
import {createMonitor} from '../platform/monitor.mjs';
import {createVault,cleanCookies,cleanTabs} from '../platform/vault.mjs';
import {memoryStore} from './helpers/platform-store.mjs';
import {token,hash,deviceInfo} from '../platform/security.mjs';

function fixture(){
 let time=1700000000;const store=memoryStore();
 const config={origin:'https://dispenser.example',internalSecret:'a'.repeat(64),formsSecret:'b'.repeat(64),formUrl:'https://docs.google.com/forms/d/e/test/viewform',formEntry:'entry.123',formId:'test-form',endpoints:['https://one.example','https://two.example'],assignedOnly:true,reportWindowSeconds:900,reportLimit:3,reportCooldownSeconds:900,reportWarningScore:2,failureThreshold:3,recoveryThreshold:2,slowThresholdMs:2000,monitorIntervalSeconds:300,probeTimeoutMs:5000};
 const accounts=createAccounts({store,config,now:()=>time}),control=createControl(accounts),monitor=createMonitor(accounts,control);
 async function register(name='snowperson',email=name+'@example.com'){
  const pending=await accounts.register({username:name,email},name),correlation=pending.siteCode;
  const verified=await accounts.verifiedEvent({eventId:token(),formId:'test-form',correlation,email});
  const session=await accounts.completeRegistration(pending.poll,'Mozilla Windows Chrome/123');return {...session,user:await accounts.me(session.access)};
 }
 async function verify(email,purpose='login',access){const pending=await accounts.startVerification({email,purpose},token(),access);const verified=await accounts.verifiedEvent({formId:'test-form',eventId:token(),email,correlation:pending.siteCode});return accounts.completeRegistration(pending.poll,'',access);}
 return {store,config,accounts,control,monitor,register,login:identity=>verify(identity.email),changeEmail:(access,identity)=>verify(identity.email,'email',access),advance:seconds=>time+=seconds};
}

test('verified email is mandatory; concurrent completion is single-use; Frost ID survives renaming',async()=>{
 const f=fixture(),pending=await f.accounts.register({email:' Snow@Example.com ',username:'SnowPerson'},'ip');
 await assert.rejects(f.accounts.completeRegistration(pending.poll,''),/verification/);
 const correlation=pending.siteCode,event={eventId:'event1',formId:'test-form',correlation,email:'snow@example.com'};
 await assert.rejects(f.accounts.verifiedEvent({...event,email:'attacker@example.com'}),/does not match/);
 const verified=await f.accounts.verifiedEvent(event);await f.accounts.verifiedEvent(event);
 const results=await Promise.allSettled([f.accounts.completeRegistration(pending.poll,''),f.accounts.completeRegistration(pending.poll,'')]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const session=results.find(r=>r.status==='fulfilled').value,user=await f.accounts.me(session.access);assert.match(user.frostId,/^fr_[0-9a-f-]{36}$/);
 const renamed=await f.accounts.rename(session.access,'new_name');assert.equal(renamed.frostId,user.frostId);assert.equal(renamed.username,'new_name');
 assert.equal(await f.accounts.available('NEW_NAME'),false);assert.equal(await f.accounts.available('snowperson'),true);
});

test('email mismatch is visible only to its poll holder and a correct resubmission recovers',async()=>{
 const f=fixture(),p=await f.accounts.register({email:'snow@example.com',username:'snow'},'ip');
 const event={eventId:'mismatch-test',formId:'test-form',correlation:p.siteCode,email:'other@example.com'};
 await assert.rejects(f.accounts.verifiedEvent(event),/does not match/);
 assert.deepEqual(await f.accounts.registrationStatus(p.poll),{status:'pending',errorCode:'EMAIL_MISMATCH'});
 await assert.rejects(f.accounts.registrationStatus(p.siteCode));
 await assert.rejects(f.accounts.completeRegistration(p.poll,''),/verification/);
 await f.accounts.verifiedEvent({...event,email:'snow@example.com'});
 assert.deepEqual(await f.accounts.registrationStatus(p.poll),{status:'verified'});
 await assert.rejects(f.accounts.verifiedEvent({...event,eventId:'late-wrong'}),/already submitted/);
 assert.deepEqual(await f.accounts.registrationStatus(p.poll),{status:'verified'});
});

test('registration reserves names atomically and expired registrations cannot verify',async()=>{
 const f=fixture();const attempts=await Promise.allSettled([f.accounts.register({email:'a@example.com',username:'same_name'},'a'),f.accounts.register({email:'b@example.com',username:'same_name'},'b')]);assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);
 const pending=attempts.find(x=>x.status==='fulfilled').value;f.advance(901);
 await assert.rejects(f.accounts.registrationStatus(pending.poll),/expired/);
 const another=await f.accounts.register({email:'c@example.com',username:'same_name'},'c');assert.ok(another.poll);
});

test('device revocation and bans invalidate account and destination sessions; unrelated devices survive',async()=>{
 const f=fixture(),first=await f.register();const second=await f.login({email:'snowperson@example.com',email_verified:true,sub:'google1'},'Firefox/12 Linux');
 const devices=await f.accounts.devices(first.access);assert.equal(devices.length,2);assert.equal(devices.filter(d=>d.current).length,1);
 await f.control.admin('endpoint',{origin:f.config.endpoints[0],action:'operational',reason:'Verified deployment'});await f.control.allocate(first.access);
 const binding=token(),handoff=await f.accounts.createHandoff(first.access,f.config.endpoints[0],binding),browse=await f.accounts.redeem(handoff.code,f.config.endpoints[0],binding);
 await f.accounts.deviceAction(second.access,{action:'revoke',id:first.user.deviceId});
 await assert.rejects(f.accounts.me(first.access),/no longer active/);await assert.rejects(f.accounts.checkBrowsing(browse.access,f.config.endpoints[0]),/no longer active/);assert.equal((await f.accounts.me(second.access)).frostId,first.user.frostId);
 await f.control.admin('user',{uid:first.user.frostId,action:'ban',reason:'Confirmed abuse'});await assert.rejects(f.accounts.me(second.access),/no longer active/);
 const banned=await f.login({email:'snowperson@example.com',email_verified:true,sub:'google1'},'');assert.equal((await f.accounts.me(banned.access)).status,'banned');await assert.rejects(f.control.allocate(banned.access),/restricted/);
 assert.equal((await f.control.support(banned.access,{type:'appeal',subject:'Please review',message:'Please review my account restriction.'})).status,'open');
});

test('refresh rotation detects reuse, tolerates immediate retry, and never stores raw credentials',async()=>{
 const f=fixture(),first=await f.register();const second=await f.accounts.refresh(first.refresh);
 await assert.rejects(f.accounts.refresh(first.refresh),error=>error.status===409);
 assert.equal((await f.accounts.me(second.access)).frostId,first.user.frostId);
 assert.ok(!JSON.stringify([...f.store.rows.values()]).includes(first.refresh));assert.ok(!JSON.stringify([...f.store.rows.values()]).includes(second.access));
 f.advance(11);await assert.rejects(f.accounts.refresh(first.refresh),/reuse/);await assert.rejects(f.accounts.me(second.access),/no longer active/);
});

test('handoffs bind destination and browser; replay and account-scope escalation fail',async()=>{
 const f=fixture(),user=await f.register();await f.control.admin('endpoint',{origin:f.config.endpoints[0],action:'operational',reason:'Ready'});await f.control.allocate(user.access);
 const binding=token(),handoff=await f.accounts.createHandoff(user.access,f.config.endpoints[0],binding);
 await assert.rejects(f.accounts.redeem(handoff.code,f.config.endpoints[1],binding));await assert.rejects(f.accounts.redeem(handoff.code,f.config.endpoints[0],token()));
 const browser=await f.accounts.redeem(handoff.code,f.config.endpoints[0],binding);await assert.rejects(f.accounts.redeem(handoff.code,f.config.endpoints[0],binding));await assert.rejects(f.accounts.me(browser.access));
 assert.equal((await f.accounts.checkBrowsing(browser.access,f.config.endpoints[0])).uid,user.user.frostId);
});

test('one assignment under concurrency, report cooldown does not ban, and network policies never rotate links',async()=>{
 const f=fixture(),user=await f.register();await f.control.admin('endpoint',{origin:f.config.endpoints[0],action:'operational',reason:'Ready'});
 const assignments=await Promise.all([f.control.allocate(user.access),f.control.allocate(user.access)]);assert.equal(assignments[0].origin,assignments[1].origin);assert.equal((await f.store.get('endpoint:'+hash(f.config.endpoints[0]))).assignments,1);
 const report=await f.control.report(user.access,{reason:'network-policy'});assert.equal(report.status,'network-policy');await assert.rejects(f.control.admin('report',{id:report.id,action:'approve-replacement',origin:f.config.endpoints[1],reason:'No'}));
 await f.control.report(user.access,{reason:'connection'});await f.control.report(user.access,{reason:'connection'});await assert.rejects(f.control.report(user.access,{reason:'connection'}),error=>error.status===429);
 assert.equal((await f.accounts.me(user.access)).status,'active');assert.ok((await f.control.restriction(user.access)).reporting.cooldownUntil>0);
});

test('preferences and device mutations remain account-scoped; public IDs never authenticate',async()=>{
 const f=fixture(),a=await f.register('person_a'),b=await f.register('person_b');
 await f.accounts.preferences(a.access,{accentIntensity:75,reducedMotion:true});assert.equal((await f.accounts.preferences(b.access)).accentIntensity,55);
 await assert.rejects(f.accounts.deviceAction(a.access,{action:'rename',id:b.user.deviceId,label:'Hijacked'}));await assert.rejects(f.accounts.me(a.user.frostId));
 await assert.rejects(f.accounts.preferences(a.access,{history:['https://example.com']}));
 assert.deepEqual(deviceInfo('<script>alert(1)</script>'),{browser:'Browser',os:'Unknown OS',type:'computer',label:'Browser on Unknown OS'});
});

test('outages need repeated failures and recovery; manual maintenance survives automatic probes',async()=>{
 const f=fixture(),origin=f.config.endpoints[0];await f.control.admin('endpoint',{origin,action:'register',reason:'Registered'});
 await f.monitor.record(origin,{ok:true,latency:100});assert.equal((await f.store.list('incidents')).items.length,0);await f.monitor.record(origin,{ok:true,latency:100});assert.equal((await f.store.get('endpoint:'+hash(origin))).observed,'operational');
 await f.monitor.record(origin,{ok:false,failure:'timeout',latency:5000});assert.equal((await f.store.get('endpoint:'+hash(origin))).observed,'degraded');
 await f.monitor.record(origin,{ok:false,failure:'timeout',latency:5000});await f.monitor.record(origin,{ok:false,failure:'timeout',latency:5000});let row=await f.store.get('endpoint:'+hash(origin));assert.equal(row.observed,'unavailable');assert.ok(row.incidentId);
 await f.control.admin('endpoint',{origin,action:'maintenance',reason:'Scheduled work'});await f.monitor.record(origin,{ok:true,latency:100});await f.monitor.record(origin,{ok:true,latency:100});row=await f.store.get('endpoint:'+hash(origin));assert.equal(f.control.effective(row),'maintenance');assert.equal(row.incidentId,null);
 assert.ok((await f.store.list('incidents')).items.every(i=>i.status==='resolved'));
});

test('trusted device grants survive inactivity, but explicit revocation still stops renewal',async()=>{
 const f=fixture(),session=await f.register();f.advance(401*86400);
 await assert.rejects(f.accounts.me(session.access),/expired/);
 const renewed=await f.accounts.refresh(session.refresh);assert.equal((await f.accounts.me(renewed.access)).frostId,session.user.frostId);
 await f.accounts.deviceAction(renewed.access,{action:'logout'});await assert.rejects(f.accounts.refresh(renewed.refresh),/no longer active/);
});

test('account vault encrypts tabs and cookies, rejects conflicting saves and never crosses accounts',async()=>{
 const f=fixture();f.config.vaultKey=Buffer.alloc(32,7).toString('base64');const vault=createVault(f.accounts),a=await f.register('person_a'),b=await f.register('person_b');
 const cookies=JSON.stringify({'ignored-key':{name:'session',value:'private-cookie-value',domain:'.example.com',path:'/',secure:true,httpOnly:true,sameSite:'Lax'}});
 const saved={revision:0,tabs:[{id:'tab1',title:'Private tab',url:'https://example.com/private',history:['https://never-upload.example']}],activeId:'tab1',cookies};
 assert.equal((await vault.sync(a.access,saved)).revision,1);
 const raw=JSON.stringify(await f.store.get('vault:'+a.user.frostId));assert.ok(!raw.includes('private-cookie-value'));assert.ok(!raw.includes('example.com'));
 const read=await vault.sync(a.access);assert.equal(read.tabs[0].url,'https://example.com/private');assert.equal(read.tabs[0].history,undefined);assert.match(read.cookies,/private-cookie-value/);
 assert.deepEqual((await vault.sync(b.access)).tabs,[]);await assert.rejects(vault.sync(a.access,saved),error=>error.status===409);
 const row=await f.store.get('vault:'+a.user.frostId);f.store.rows.set('vault:'+b.user.frostId,row);await assert.rejects(vault.sync(b.access),/could not be verified/);
 await f.control.admin('user',{uid:a.user.frostId,action:'ban',reason:'Test restriction'});await assert.rejects(vault.sync(a.access));
});

test('vault validation prunes expired cookies, rejects executable URLs and fails closed without encryption',async()=>{
 const f=fixture(),a=await f.register(),vault=createVault(f.accounts);await assert.rejects(vault.sync(a.access),error=>error.status===503);
 assert.equal(cleanCookies(JSON.stringify({x:{name:'expired',value:'gone',domain:'.example.com',path:'/',expires:1}})),'{}');
 assert.throws(()=>cleanTabs({tabs:[{id:'one',title:'Bad',url:'javascript:alert(1)'}],activeId:'one'}));
 assert.throws(()=>cleanTabs({tabs:[{id:'one',title:'Bad',url:'https://user:pass@example.com'}],activeId:'one'}));
 assert.throws(()=>cleanCookies(JSON.stringify({x:{name:'bad\r\n',value:'bad',domain:'.example.com',path:'/'}})));
});

test('deleting a restricted account cannot bypass its ban; owner can clear the retained restriction',async()=>{
 const f=fixture(),user=await f.register();await f.control.admin('user',{uid:user.user.frostId,action:'ban',reason:'Confirmed abuse'});
 const restricted=await f.login({email:'snowperson@example.com',email_verified:true,sub:'identity'},'');await f.control.deleteAccount(restricted.access);await f.control.cleanup();
 assert.equal((await f.store.list('credentials:'+user.user.frostId)).items.length,0);
 const pending=await f.accounts.register({username:'another_name',email:'snowperson@example.com'},'ip'),event={formId:'test-form',eventId:token(),email:'snowperson@example.com',correlation:pending.siteCode};
 await assert.rejects(f.accounts.verifiedEvent(event),/restricted/);
 const other=await f.register('unrelated_user');await assert.rejects(f.changeEmail(other.access,{email:'snowperson@example.com',email_verified:true,sub:'identity'}),/restricted/);
 await f.control.admin('clear-deleted-restriction',{uid:user.user.frostId,reason:'Appeal approved'});await f.accounts.verifiedEvent(event);assert.equal((await f.accounts.registrationStatus(pending.poll)).status,'verified');
});

test('verified login recovers at the device limit and after an owner revokes all sessions',async()=>{
 const f=fixture(),first=await f.register();
 for(let i=0;i<21;i++)await f.login({email:'snowperson@example.com',email_verified:true,sub:'identity'},'');
 await assert.rejects(f.accounts.me(first.access),/no longer active/);
 await f.control.admin('user',{uid:first.user.frostId,action:'revoke',reason:'Recovery'});
 const recovered=await f.login({email:'snowperson@example.com',email_verified:true,sub:'identity'},'');assert.equal((await f.accounts.me(recovered.access)).status,'active');
 assert.equal((await f.accounts.devices(recovered.access)).length,1);
});

test('username conflicts remain enforced without a shared registration cooldown',async()=>{
 const f=fixture();await f.accounts.register({username:'reserved_name',email:'a@example.com'},'same-ip');
 for(let i=0;i<4;i++)await assert.rejects(f.accounts.register({username:'reserved_name',email:'b@example.com'},'same-ip'),error=>error.status===409);
 assert.ok((await f.accounts.register({username:'different_name',email:'b@example.com'},'same-ip')).siteCode);
});

test('returning email verification preserves identity and rejects mismatch, replay and expired proof',async()=>{
 const f=fixture(),original=await f.register();
 const pending=await f.accounts.startVerification({email:'snowperson@example.com'},'returning');
 await assert.rejects(f.accounts.completeRegistration(pending.poll,''),/verification/);
 const event={formId:'test-form',eventId:token(),email:'snowperson@example.com',correlation:pending.siteCode};
 await assert.rejects(f.accounts.verifiedEvent({...event,email:'wrong@example.com'}),/does not match/);
 const verified=await f.accounts.verifiedEvent(event);const session=await f.accounts.completeRegistration(pending.poll,'');assert.equal((await f.accounts.me(session.access)).frostId,original.user.frostId);
 await assert.rejects(f.accounts.completeRegistration(pending.poll,''));
 const expired=await f.accounts.startVerification({email:'snowperson@example.com'},'another');f.advance(901);await assert.rejects(f.accounts.verifiedEvent({...event,eventId:token(),correlation:expired.siteCode}),/expired/);
});

test('site code is separate from the private polling cookie and is not prefilled in the Form URL',async()=>{
 const f=fixture(),pending=await f.accounts.register({email:'code@example.com',username:'code_user'},'ip');
 assert.match(pending.siteCode,/^[A-Za-z0-9_-]{43}$/);assert.notEqual(pending.siteCode,pending.poll);assert.ok(!pending.formUrl.includes(pending.siteCode));
 await assert.rejects(f.accounts.registrationStatus(pending.siteCode));await assert.rejects(f.accounts.completeRegistration(pending.poll,''));
 const result=await f.accounts.verifiedEvent({formId:'test-form',eventId:token(),email:'code@example.com',correlation:pending.siteCode});assert.deepEqual(result,{ok:true});
 const session=await f.accounts.completeRegistration(pending.poll,'');assert.equal((await f.accounts.me(session.access)).username,'code_user');
});

test('unified entry verifies first, then creates one account and reuses it on return',async()=>{
 const f=fixture(),email='unified@example.com';
 const begin=async()=>{const p=await f.accounts.startVerification({email,purpose:'entry'},token());await f.accounts.verifiedEvent({formId:'test-form',eventId:token(),email,correlation:p.siteCode});return p;};
 const unverified=await f.accounts.startVerification({email,purpose:'entry'},'first');
 await assert.rejects(f.accounts.completeRegistration(unverified.poll,'',undefined,{username:'unified'}),/verification/);
 const pending=await begin();assert.equal((await f.accounts.registrationStatus(pending.poll)).status,'needs_username');
 await assert.rejects(f.accounts.completeRegistration(pending.poll,'',undefined,{username:'admin'}),/different username/);
 const results=await Promise.allSettled([f.accounts.completeRegistration(pending.poll,'',undefined,{username:'unified'}),f.accounts.completeRegistration(pending.poll,'',undefined,{username:'unified'})]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);const session=results.find(x=>x.status==='fulfilled').value,user=await f.accounts.me(session.access);
 const returning=await begin();assert.equal((await f.accounts.registrationStatus(returning.poll)).status,'verified');
 const next=await f.accounts.completeRegistration(returning.poll,'');assert.equal((await f.accounts.me(next.access)).frostId,user.frostId);
 await f.control.admin('user',{uid:user.frostId,action:'ban',reason:'Test restriction'});
 const banned=await begin(),appeals=await f.accounts.completeRegistration(banned.poll,'');assert.equal((await f.accounts.me(appeals.access)).status,'banned');
});
test('unified username setup handles conflicts, expiry and concurrent email claims without duplicate users',async()=>{
 const f=fixture();await f.register('taken');const email='double@example.com';
 const begin=async()=>{const p=await f.accounts.startVerification({email,purpose:'entry'},token());await f.accounts.verifiedEvent({formId:'test-form',eventId:token(),email,correlation:p.siteCode});return p;};
 const a=await begin(),b=await begin();await assert.rejects(f.accounts.completeRegistration(a.poll,'',undefined,{username:'taken'}),e=>e.status===409);
 const results=await Promise.allSettled([f.accounts.completeRegistration(a.poll,'',undefined,{username:'double_a'}),f.accounts.completeRegistration(b.poll,'',undefined,{username:'double_b'})]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.match(results.find(x=>x.status==='rejected').reason.message,/Verify your email again/);
 const user=await f.accounts.me(results.find(x=>x.status==='fulfilled').value.access);assert.equal((await f.store.list('users')).items.filter(x=>x.email===email).length,1);
 const returning=await begin(),session=await f.accounts.completeRegistration(returning.poll,'');assert.equal((await f.accounts.me(session.access)).frostId,user.frostId);
 const expired=await f.accounts.startVerification({email:'expired@example.com',purpose:'entry'},token());await f.accounts.verifiedEvent({formId:'test-form',eventId:token(),email:'expired@example.com',correlation:expired.siteCode});f.advance(901);
 await assert.rejects(f.accounts.completeRegistration(expired.poll,'',undefined,{username:'expired_entry'}));
});

test('a pre-account username proof cannot bypass a later owner session revocation',async()=>{
 const f=fixture(),email='revoked_entry@example.com';
 const begin=async()=>{const p=await f.accounts.startVerification({email,purpose:'entry'},token());await f.accounts.verifiedEvent({formId:'test-form',eventId:token(),email,correlation:p.siteCode});return p;};
 const first=await begin(),stale=await begin(),session=await f.accounts.completeRegistration(first.poll,'',undefined,{username:'revoked_entry'}),user=await f.accounts.me(session.access);
 await f.control.admin('user',{uid:user.frostId,action:'revoke',reason:'Explicit owner revocation'});
 await assert.rejects(f.accounts.completeRegistration(stale.poll,'',undefined,{username:'stale_entry'}),e=>e.status===409&&/Verify your email again/.test(e.message));
 await assert.rejects(f.accounts.me(session.access),/no longer active/);
 const fresh=await begin(),recovered=await f.accounts.completeRegistration(fresh.poll,'');assert.equal((await f.accounts.me(recovered.access)).frostId,user.frostId);
});

test('username completion counts rejected names durably and isolates each verified poll budget',async()=>{
 const f=fixture();await f.register('taken_profile');
 const begin=async email=>{const p=await f.accounts.startVerification({email,purpose:'entry'},token());await f.accounts.verifiedEvent({formId:'test-form',eventId:token(),email,correlation:p.siteCode});return p;};
 const pending=await begin('budget@example.com');
 for(let i=0;i<10;i++)await assert.rejects(f.accounts.completeRegistration(pending.poll,'',undefined,{username:i%2?'admin':'taken_profile'}),e=>e.status===400||e.status===409);
 await assert.rejects(f.accounts.completeRegistration(pending.poll,'',undefined,{username:'budget_user'}),e=>e.status===429&&e.retryAfter>0);
 assert.equal((await f.accounts.registrationStatus(pending.poll)).status,'needs_username');
 const independent=await begin('independent@example.com'),session=await f.accounts.completeRegistration(independent.poll,'',undefined,{username:'independent_user'});assert.equal((await f.accounts.me(session.access)).username,'independent_user');
});
test('unified entry cannot recreate a deleted restricted identity',async()=>{
 const f=fixture(),session=await f.register('restricted_entry');await f.control.admin('user',{uid:session.user.frostId,action:'ban',reason:'Test'});const restricted=await f.login({email:'restricted_entry@example.com'});await f.control.deleteAccount(restricted.access);
 const p=await f.accounts.startVerification({email:'restricted_entry@example.com',purpose:'entry'},token());await f.accounts.verifiedEvent({formId:'test-form',eventId:token(),email:'restricted_entry@example.com',correlation:p.siteCode});
 await assert.rejects(f.accounts.completeRegistration(p.poll,'',undefined,{username:'replacement_entry'}),e=>e.status===403);
});

test('links auto-assign, block and replace, refuse blocked manual targets, and recover when none available',async()=>{
 const f=fixture();for(const origin of f.config.endpoints){await f.control.admin('endpoint',{action:'register',origin,reason:'test'});await f.control.admin('endpoint',{action:'operational',origin,reason:'test'});}
 const a=await f.register('links_a'),b=await f.register('links_b');const first=await f.control.assignment(a.access),second=await f.control.assignment(b.access);assert.notEqual(first.origin,second.origin);
 await f.control.admin('link',{origin:first.origin,action:'block',reason:'Owner maintenance'});
 assert.equal((await f.control.assignment(a.access)).origin,second.origin);
 await assert.rejects(f.control.admin('assign',{uid:a.user.frostId,origin:first.origin,reason:'test'}),/No link/);
 await f.control.admin('link',{origin:second.origin,action:'block',reason:'Owner maintenance'});
 assert.equal(await f.control.assignment(a.access),null);await assert.rejects(f.control.allocate(a.access),/No link/);
 await f.control.admin('link',{origin:first.origin,action:'unblock',reason:'Ready again'});await f.control.rebalance();
 assert.equal((await f.control.assignment(a.access)).origin,first.origin);assert.equal((await f.control.assignment(b.access)).origin,first.origin);
 await f.control.admin('link',{origin:second.origin,action:'unblock',reason:'Ready again'});
 await f.control.admin('assign',{uid:a.user.frostId,origin:second.origin,reason:'Manual owner choice'});assert.equal((await f.control.assignment(a.access)).origin,second.origin);
 const links=await f.control.admin('links');assert.equal(links.items.reduce((sum,e)=>sum+e.assignments,0),2);assert.ok(links.items.every(e=>e.assignments===1));
 const audit=await f.control.admin('list',{kind:'audit'});assert.ok(audit.items.some(e=>e.action==='assign'));
});

function rebalanceFixture(count=23){
 const f=fixture(),[origin,destination]=f.config.endpoints,key='link-job:'+hash(origin);
 f.store.rows.set('endpoint:'+hash(origin),{origin,blocked:true,override:'operational',assignments:count,_v:1});
 f.store.rows.set('endpoint:'+hash(destination),{origin:destination,override:'operational',assignments:0,_v:1});
 f.store.rows.set(key,{kind:'link-jobs',sort:origin,id:'original-job',origin,cursor:null,_v:1});
 for(let i=0;i<count;i++){const uid='migration_'+i;f.store.rows.set('user:'+uid,{kind:'users',sort:String(i).padStart(3,'0'),uid,status:'active',_v:1});f.store.rows.set('assignment:'+uid,{uid,origin,_v:1});}
 return {...f,origin,destination,key};
}

test('rebalance paginates beyond one batch and stale workers cannot regress the cursor or double-count moves',async()=>{
 const f=rebalanceFixture(),list=f.store.list.bind(f.store);let release,started;
 const gate=new Promise(resolve=>{release=resolve;}),ready=new Promise(resolve=>{started=resolve;});let pause=true;
 f.store.list=async(kind,options)=>{const page=await list(kind,options);if(kind==='users'&&pause){pause=false;started();await gate;}return page;};
 const stale=f.control.rebalance();await ready;
 assert.equal((await f.control.rebalance()).moved,10);assert.equal((await f.control.rebalance()).moved,10);
 const cursor=(await f.store.get(f.key)).cursor;assert.ok(cursor);
 release();assert.equal((await stale).moved,0);assert.equal((await f.store.get(f.key)).cursor,cursor);
 assert.equal((await f.control.rebalance()).moved,3);assert.equal(await f.store.get(f.key),null);
 assert.equal((await f.store.get('endpoint:'+hash(f.origin))).assignments,0);assert.equal((await f.store.get('endpoint:'+hash(f.destination))).assignments,23);
 for(let i=0;i<23;i++)assert.equal((await f.store.get('assignment:migration_'+i)).origin,f.destination);
});

test('rebalance stale unblocked observation cannot delete a replacement block job',async()=>{
 const f=rebalanceFixture(0),endpointKey='endpoint:'+hash(f.origin),get=f.store.get.bind(f.store);let inject=true;
 f.store.get=async key=>{const value=await get(key);if(key===endpointKey&&inject){inject=false;
                                                                      
  f.store.rows.set(f.key,{...await get(f.key),id:'replacement-job',_v:2});f.store.rows.set(endpointKey,{...value,blocked:true,_v:2});return {...value,blocked:false};
 }return value;};
 await f.control.rebalance();assert.equal((await get(f.key)).id,'replacement-job');assert.equal((await get(endpointKey)).blocked,true);
});

 test('ongoing connection permits survive access expiry but reject bans, revocation and moved assignments',async()=>{
 const f=fixture(),a=await f.register('connected'),b=await f.register('unrelated');
 for(const origin of f.config.endpoints)await f.control.admin('endpoint',{origin,action:'operational',reason:'test'});
 const assigned=await f.control.allocate(a.access),binding=token(),handoff=await f.accounts.createHandoff(a.access,assigned.origin,binding),session=await f.accounts.redeem(handoff.code,assigned.origin,binding),grant=await f.accounts.checkBrowsing(session.access,assigned.origin);
 f.advance(901);assert.deepEqual(await f.accounts.checkConnection(grant,assigned.origin),{allowed:true});
 await assert.rejects(f.accounts.checkConnection({...grant,uid:b.user.frostId},assigned.origin),e=>e.status===401);
 await f.control.admin('assign',{uid:a.user.frostId,origin:f.config.endpoints.find(o=>o!==assigned.origin),reason:'test'});
 await assert.rejects(f.accounts.checkConnection(grant,assigned.origin),e=>e.code==='ASSIGNMENT_CHANGED');
 await f.control.admin('user',{uid:a.user.frostId,action:'ban',reason:'test'});
 await assert.rejects(f.accounts.checkConnection(grant,assigned.origin),e=>e.code==='ACCOUNT_RESTRICTED');
 await f.control.admin('user',{uid:a.user.frostId,action:'unban',reason:'test'});
 await assert.rejects(f.accounts.checkConnection(grant,assigned.origin),e=>e.status===401);
 });

test('browser refresh targets one account or everyone without revoking sessions; throttled and audited',async()=>{
 const f=fixture(),a=await f.register('snow_a'),b=await f.register('snow_b'),origin=f.config.endpoints[0];
 await f.control.admin('endpoint',{origin,action:'operational',reason:'Test'});
 async function browse(session){await f.control.allocate(session.access);const binding=token(),handoff=await f.accounts.createHandoff(session.access,origin,binding);return f.accounts.redeem(handoff.code,origin,binding);}
 const aa=await browse(a),bb=await browse(b),check=access=>f.accounts.checkBrowsing(access,origin);
 assert.deepEqual((await check(aa.access)).refresh,{all:0,account:0});
 await assert.rejects(f.control.admin('refresh',{scope:'all',reason:'Update'}),/Confirm/);
 await assert.rejects(f.control.admin('refresh',{scope:'account',uid:'bad',reason:'Update'}),/valid account/);
 await f.control.admin('refresh',{scope:'account',uid:a.user.frostId,reason:'Update'});
 assert.deepEqual((await check(aa.access)).refresh,{all:0,account:1});assert.deepEqual((await check(bb.access)).refresh,{all:0,account:0});
 await assert.rejects(f.control.admin('refresh',{scope:'account',uid:a.user.frostId,reason:'Update'}),/30 seconds/);
 await f.control.admin('refresh',{scope:'all',confirmAll:true,reason:'Update everyone'});
 assert.deepEqual((await check(aa.access)).refresh,{all:1,account:1});assert.deepEqual((await check(bb.access)).refresh,{all:1,account:0});
 f.advance(31);await f.control.admin('refresh',{scope:'account',uid:a.user.frostId,reason:'Another update'});
 assert.equal((await check(aa.access)).refresh.account,2);assert.equal((await f.accounts.me(a.access)).status,'active');
 const audit=await f.control.admin('list',{kind:'audit'});assert.equal(audit.items.filter(x=>x.action==='browser:refresh').length,3);
});

test('forced username change blocks handoffs and active browsing until a different valid name is saved',async()=>{
 const f=fixture(),a=await f.register();for(const origin of f.config.endpoints)await f.control.admin('endpoint',{origin,action:'operational',reason:'test'});const assigned=await f.control.allocate(a.access),binding=token();
 const h=await f.accounts.createHandoff(a.access,assigned.origin,binding),b=await f.accounts.redeem(h.code,assigned.origin,binding),grant=await f.accounts.checkBrowsing(b.access,assigned.origin);
 const pending=await f.accounts.createHandoff(a.access,assigned.origin,binding);
 await assert.rejects(f.control.admin('user',{uid:a.user.frostId,action:'force-username',usernameReason:'invalid',reason:'Please update'}));
 await f.control.admin('user',{uid:a.user.frostId,action:'force-username',usernameReason:'Impersonation',reason:'Choose a name that identifies you.'});
 const me=await f.accounts.me(a.access);assert.equal(me.usernameChangeRequired,true);assert.match(me.usernameChangeReason,/Impersonation/);
 const required=e=>e.code==='USERNAME_CHANGE_REQUIRED';
 await assert.rejects(f.accounts.checkBrowsing(b.access,assigned.origin),required);await assert.rejects(f.accounts.checkConnection(grant,assigned.origin),required);await assert.rejects(f.accounts.createHandoff(a.access,assigned.origin,binding),required);await assert.rejects(f.accounts.redeem(pending.code,assigned.origin,binding),required);
 await assert.rejects(f.control.deleteAccount(a.access),/username/);await assert.rejects(f.accounts.rename(a.access,'snowperson'),/different/);await assert.rejects(f.accounts.rename(a.access,'bad name'));
 const renamed=await f.accounts.rename(a.access,'fresh_snow');assert.equal(renamed.usernameChangeRequired,false);assert.equal(renamed.frostId,a.user.frostId);assert.equal((await f.accounts.checkConnection(grant,assigned.origin)).allowed,true);await assert.rejects(f.accounts.rename(a.access,'snowperson'),/different/);
 const audits=await f.store.list('audit');assert.ok(audits.items.some(x=>x.action==='force-username'));
});

test('timed suspensions validate duration, expire at boundary and never revive old grants',async()=>{
 const f=fixture(),a=await f.register('timed'),uid=a.user.frostId,origin=f.config.endpoints[0];
 await f.control.admin('endpoint',{origin,action:'operational',reason:'Test'});
 await f.control.allocate(a.access);
 const binding=token(),handoff=await f.accounts.createHandoff(a.access,origin,binding),browse=await f.accounts.redeem(handoff.code,origin,binding),oldGrant=await f.accounts.checkBrowsing(browse.access,origin);
 for(const durationSeconds of [undefined,0,-1,59,60.5,'60',Infinity,365*86400+1])await assert.rejects(f.control.admin('user',{uid,action:'suspend',reason:'Test',durationSeconds}),e=>e.status===400);
 await f.control.admin('user',{uid,action:'suspend',reason:'Temporary test',durationSeconds:60});
 await assert.rejects(f.accounts.checkConnection(oldGrant,origin),e=>e.code==='ACCOUNT_RESTRICTED');
 const restricted=await f.login(a.user);
 assert.equal((await f.accounts.me(restricted.access)).status,'suspended');
 const detail=await f.control.restriction(restricted.access);assert.equal(detail.until,detail.serverTime+60);
 await f.control.support(restricted.access,{type:'appeal',subject:'Review',message:'Please review.'});
 await assert.rejects(f.accounts.createHandoff(restricted.access,origin,token()));
 f.advance(59);await assert.rejects(f.accounts.createHandoff(restricted.access,origin,token()));
 f.advance(1);assert.equal((await f.accounts.me(restricted.access)).status,'active');
 await assert.rejects(f.accounts.checkConnection(oldGrant,origin),e=>e.status===401);
 await assert.rejects(f.accounts.refresh(browse.refresh,'browse',origin),e=>e.status===401);
 const newBinding=token(),next=await f.accounts.createHandoff(restricted.access,origin,newBinding);
 const resumed=await f.accounts.redeem(next.code,origin,newBinding),grant=await f.accounts.checkBrowsing(resumed.access,origin);
 assert.equal((await f.store.get('user:'+uid)).browserSeenEpoch,grant.epoch);
 await f.control.admin('refresh',{scope:'account',uid,reason:'Test recovery'});
 const notices=await f.control.admin('list',{kind:'audit'});assert.ok(notices.items.some(r=>r.action==='suspend'&&r.reason.includes('60 seconds')));
});

test('new bans and legacy suspensions do not expire; revocation preserves deadline',async()=>{
 const f=fixture(),a=await f.register('suspend_again'),uid=a.user.frostId;
 await f.control.admin('user',{uid,action:'suspend',reason:'Original reason',durationSeconds:60});
 const until=(await f.store.get('user:'+uid)).restrictionUntil;
 await f.control.admin('user',{uid,action:'revoke',reason:'Device cleanup'});
 assert.equal((await f.store.get('user:'+uid)).restrictionUntil,until);
 assert.equal((await f.store.get('user:'+uid)).restrictionReason,'Original reason');
 await f.control.admin('user',{uid,action:'ban',reason:'New permanent ban'});
 f.advance(61);const session=await f.login(a.user);assert.equal((await f.accounts.me(session.access)).status,'banned');
 const row=await f.store.get('user:'+uid);f.store.rows.set('user:'+uid,{...row,status:'suspended',restrictionUntil:null});
 assert.equal((await f.accounts.me(session.access)).status,'suspended');
});

test('deleted timed restriction expires without letting old cleanup remove a newer ban',async()=>{
 const f=fixture(),a=await f.register('old_timed','reuse@example.com'),uid=a.user.frostId;
 await f.control.admin('user',{uid,action:'suspend',reason:'Temporary',durationSeconds:60});
 const restricted=await f.login(a.user);await f.control.deleteAccount(restricted.access);
 async function entry(){const pending=await f.accounts.startVerification({email:a.user.email,purpose:'entry'},token());await f.accounts.verifiedEvent({eventId:token(),formId:'test-form',correlation:pending.siteCode,email:a.user.email});return pending;}
 let pending=await entry();await assert.rejects(f.accounts.completeRegistration(pending.poll,'',undefined,{username:'new_timed'}),/restricted/);
 f.advance(60);pending=await entry();const b=await f.accounts.completeRegistration(pending.poll,'',undefined,{username:'new_timed'}),me=await f.accounts.me(b.access);
 await f.control.admin('user',{uid:me.frostId,action:'ban',reason:'New ban'});
 await f.control.deleteAccount((await f.login(me)).access);
 await f.control.admin('clear-deleted-restriction',{uid,reason:'Clear old record'});
 pending=await entry();await assert.rejects(f.accounts.completeRegistration(pending.poll,'',undefined,{username:'third_timed'}),/restricted/);
});

test('support permits one open request atomically, owner close, and guarded admin reopen',async()=>{
 const f=fixture(),a=await f.register('winter_a'),b=await f.register('winter_b');
 const body={subject:'Help please',message:'Connection issue'};
 const starts=await Promise.allSettled([f.control.support(a.access,body),f.control.support(a.access,body)]);
 assert.equal(starts.filter(x=>x.status==='fulfilled').length,1);
 const id=starts.find(x=>x.status==='fulfilled').value.id;
 assert.equal((await f.control.supportState(a.access)).openTicket.id,id);
 await assert.rejects(f.control.closeSupport(b.access,id),e=>e.status===404);
 await f.control.closeSupport(a.access,id);assert.equal((await f.control.supportState(a.access)).openTicket,null);
 const next=await f.control.support(a.access,body);
 await assert.rejects(f.control.admin('ticket',{id,operation:'reopen'}),e=>e.status===409);
 await f.control.admin('ticket',{id:next.id,operation:'close'});await f.control.admin('ticket',{id,operation:'reopen'});
 assert.equal((await f.control.supportState(a.access)).openTicket.id,id);
});
test('support actions flag assistance, replace only with a different healthy link, and preserve public copies',async()=>{
 const f=fixture(),a=await f.register('help_user');
 for(const origin of f.config.endpoints)await f.control.admin('endpoint',{origin,action:'operational',reason:'Ready'});
 const first=await f.control.allocate(a.access),ticket=await f.control.support(a.access,{subject:'A new link',message:'Please help'});
 await f.control.admin('ticket',{id:ticket.id,operation:'assist'});
 assert.equal((await f.control.admin('list',{kind:'tickets',status:'assistance'})).items[0].username,'help_user');
 assert.equal((await f.control.ownedList(a.access,'tickets')).items[0].needsAssistance,undefined);
 await f.control.admin('ticket',{id:ticket.id,operation:'claim'});
 assert.equal((await f.control.admin('list',{kind:'tickets',status:'assistance'})).items.length,0);
 const replaced=await f.control.admin('ticket',{id:ticket.id,operation:'assign'});assert.notEqual(replaced.origin,first.origin);
 await f.control.admin('link',{origin:first.origin,action:'block',reason:'Unavailable'});
 await assert.rejects(f.control.admin('ticket',{id:ticket.id,operation:'assign'}),e=>e.status===503);
 assert.equal((await f.control.assignment(a.access)).origin,replaced.origin);
 await f.control.admin('ticket',{id:ticket.id,operation:'close'});
 assert.equal((await f.control.admin('list',{kind:'tickets',status:'open'})).items.length,0);
 assert.equal((await f.control.admin('list',{kind:'tickets',status:'closed'})).items.length,1);
 await assert.rejects(f.control.admin('ticket',{id:ticket.id,operation:'assign'}),e=>e.status===409);
});
test('support filtering finds matches beyond the first page and legacy open requests block duplicates',async()=>{
 const f=fixture(),a=await f.register('legacy_support');
 for(let i=0;i<55;i++){const row={id:'legacy'+i,uid:a.user.frostId,kind:'tickets',sort:String(i).padStart(3,'0'),status:i===0?'open':'closed',subject:'Legacy',message:'Help',replies:[],expires:1800000000};f.store.rows.set('ticket:'+row.id,row);f.store.rows.set('user-ticket:'+row.id,{...row,kind:'tickets:'+a.user.frostId});}
 assert.equal((await f.control.admin('list',{kind:'tickets',status:'open'})).items[0].id,'legacy0');
 await assert.rejects(f.control.support(a.access,{subject:'Duplicate',message:'No'}),e=>e.status===409);
});



test('two-way support chat enforces ownership, preserves messages, and anonymizes legacy admin names',async()=>{
 const f=fixture(),a=await f.register('chat_user'),b=await f.register('other_chat');const ticket=await f.control.support(a.access,{subject:'Chat',message:'First message'});
 await assert.rejects(f.control.replySupport(b.access,{id:ticket.id,message:'Spoof'}),e=>e.status===404);
 await assert.rejects(f.control.supportThread(b.access,ticket.id),e=>e.status===404);
 await f.control.replySupport(a.access,{id:ticket.id,message:'More detail',sender:'admin',actor:'Administrator'});
 await f.control.admin('ticket',{id:ticket.id,operation:'claim'});
 await f.control.admin('ticket',{id:ticket.id,status:'open',message:'Thanks',showUsername:true});
 const row=await f.control.supportThread(a.access,ticket.id);assert.equal(row.replies[0].sender,'user');assert.equal(row.replies[1].actor,'Administrator');assert.equal(row.claimedBy,undefined);
 const stored=await f.store.get('user-ticket:'+ticket.id);stored.replies[1].actor='Administrator Garrett';f.store.rows.set('user-ticket:'+ticket.id,stored);
 assert.equal((await f.control.supportThread(a.access,ticket.id)).replies[1].actor,'Administrator');assert.equal((await f.control.ownedList(a.access,'tickets')).items[0].replies[1].actor,'Administrator');
 await f.control.closeSupport(a.access,ticket.id);await assert.rejects(f.control.replySupport(a.access,{id:ticket.id,message:'Late'}),e=>e.status===409);
});


test('expired support conversations cannot be read or replied to by direct id',async()=>{
 const f=fixture(),a=await f.register('expired_chat'),ticket=await f.control.support(a.access,{subject:'Old',message:'Old request'});f.advance(181*86400);
 const fresh=await f.login({email:'expired_chat@example.com'});
 await assert.rejects(f.control.supportThread(fresh.access,ticket.id),e=>e.status===404);
 await assert.rejects(f.control.replySupport(fresh.access,{id:ticket.id,message:'Too late'}),e=>e.status===404);
 await assert.rejects(f.control.admin('ticket',{id:ticket.id,operation:'read'}),e=>e.status===404);
});
