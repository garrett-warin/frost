import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlatformService} from '../platform/http.mjs';
import {createStaff} from '../platform/staff.mjs';
import {memoryStore} from './helpers/platform-store.mjs';
import {hash,token} from '../platform/security.mjs';
import {atomic} from '../platform/store.mjs';
async function setup(clock=()=>1000){const store=memoryStore(),config={origin:'https://accounts.example',internalSecret:'i'.repeat(64),endpoints:[],vaultKey:Buffer.alloc(32).toString('base64')},service=createPlatformService({store,config,now:clock});const sessions={};await atomic(store,async tx=>{await tx.put('staff-roster',{owner:'owner',admins:['admin']});for(const uid of ['owner','admin','member']){const access=token();sessions[uid]=access;await tx.put('user:'+uid,{uid,username:uid,email:uid+'@example.com',status:'active',epoch:1,devices:[uid]});await tx.put('family:'+uid,{fid:uid,uid,epoch:1,revoked:false});await tx.put('access:'+hash(access),{uid,fid:uid,epoch:1,scope:'account',origin:config.origin,expires:2000});}});const staff=createStaff(service.accounts);return {store,service,sessions,run:(uid,path,body={})=>staff.run(sessions[uid],path,body,service.accounts.csrf(uid))};}
test('owner grants and removes admins; removed role is denied using the same session',async()=>{const f=await setup();await assert.rejects(f.run('member','/session'),e=>e.status===403);await f.run('owner','/staff/change',{uid:'member',action:'add',reason:'Staff member'});assert.equal((await f.run('member','/session')).role,'admin');await f.run('owner','/staff/change',{uid:'member',action:'remove',reason:'No longer staff'});await assert.rejects(f.run('member','/session'),e=>e.status===403);const audit=await f.store.list('audit');assert.equal(audit.items.length,2);assert.ok(audit.items.every(x=>x.actor==='owner'));});
test('admin cannot grant roles, remove owner, or restrict owner and peer admins',async()=>{const f=await setup();await assert.rejects(f.run('admin','/staff/change',{uid:'member',action:'add',reason:'No'}),e=>e.status===403);await assert.rejects(f.run('owner','/staff/change',{uid:'owner',action:'remove',reason:'No'}),e=>e.status===403);for(const uid of ['owner','admin'])await assert.rejects(f.run('admin','/accounts/action',{uid,action:'ban',reason:'No'}),e=>e.status===403);});
test('banned admin, revoked family, wrong CSRF and browse-scope sessions cannot administer',async()=>{const f=await setup();const staff=createStaff(f.service.accounts);await assert.rejects(staff.run(f.sessions.admin,'/session',{},'wrong'),e=>e.status===403);await atomic(f.store,async tx=>{const u=await tx.get('user:admin');await tx.put('user:admin',{...u,status:'banned'});});await assert.rejects(f.run('admin','/session'),e=>e.status===403);await atomic(f.store,async tx=>{const family=await tx.get('family:owner');await tx.put('family:owner',{...family,revoked:true});});await assert.rejects(f.run('owner','/session'),e=>e.status===401);await atomic(f.store,async tx=>{const key='access:'+hash(f.sessions.member),s=await tx.get(key);await tx.put(key,{...s,scope:'browse'});});await assert.rejects(f.run('member','/session'),e=>e.status===401);});
test('staff API rejects public requests and cannot dispatch unknown IAM owner actions',async()=>{const f=await setup();const result=await f.service.handler({rawPath:'/api/admin/staff/change',requestContext:{http:{method:'POST'}},headers:{origin:'https://accounts.example','content-type':'application/json'},body:JSON.stringify({uid:'member',action:'add',source:'frost.admin'})});assert.equal(result.statusCode,401);await assert.rejects(f.run('owner','/sample'),e=>e.status===404);});

test('staff dashboard uses the viewer timezone',async()=>{const f=await setup();assert.equal((await f.run('owner','/dashboard',{range:'day',timezone:'America/New_York'})).timezone,'America/New_York');await assert.rejects(f.run('owner','/dashboard',{timezone:'invalid'}),e=>e.status===400);});

test('template inspection and moderation stay behind staff authorization',async()=>{const f=await setup();for(const path of ['/templates/list','/templates/reports','/templates/detail','/templates/remove'])await assert.rejects(f.run('member',path,{id:'test',reason:'test'}),e=>e.status===403);await assert.rejects(f.run('owner','/templates/list'),e=>e.status===410);await assert.rejects(f.run('admin','/templates/reports'),e=>e.status===410);});

test('ticket claims and audit identity are server-derived while replies remain anonymous',async()=>{
 const f=await setup(),ticket=await f.service.control.support(f.sessions.member,{subject:'Help',message:'A test request'});
 await assert.rejects(f.run('member','/tickets/reply',{id:ticket.id,operation:'claim'}),e=>e.status===403);
 await f.run('admin','/tickets/reply',{id:ticket.id,operation:'claim',actor:'forged'});
 await assert.rejects(f.run('owner','/tickets/reply',{id:ticket.id,operation:'claim'}),e=>e.status===409);
 await assert.rejects(f.run('owner','/tickets/reply',{id:ticket.id,operation:'unclaim'}),e=>e.status===409);
 await assert.rejects(f.run('owner','/tickets/reply',{id:ticket.id,status:'open',message:'Not mine',claimedBy:'owner'}),e=>e.status===409);
 await f.run('admin','/tickets/reply',{id:ticket.id,operation:'unclaim'});
 await assert.rejects(f.run('admin','/tickets/reply',{id:ticket.id,status:'open',message:'Unclaimed'}),e=>e.status===409);
 await f.run('admin','/tickets/reply',{id:ticket.id,operation:'claim'});
 await f.run('admin','/tickets/reply',{id:ticket.id,status:'open',message:'Named',showUsername:true,username:'forged'});
 await f.run('admin','/tickets/reply',{id:ticket.id,status:'open',message:'Generic',showUsername:false});
 const row=await f.store.get('ticket:'+ticket.id);assert.equal(row.replies[0].actor,'Administrator');assert.equal(row.replies[1].actor,'Administrator');
 const audit=await f.run('admin','/activity',{kind:'audit'});assert.ok(audit.items.every(r=>r.actor==='admin'&&r.actorUsername==='admin'));
 await f.service.control.closeSupport(f.sessions.member,ticket.id);const logs=await f.run('admin','/activity',{kind:'audit'});assert.equal(logs.items.find(r=>r.action==='ticket:user-close').actor,'member');
});

test('ticket quick assignment cannot bypass owner and peer admin protections',async()=>{
 const f=await setup();for(const uid of ['owner','admin']){const ticket=await f.service.control.support(f.sessions[uid],{subject:'Help',message:'A test request'});await assert.rejects(f.run('admin','/tickets/reply',{id:ticket.id,operation:'assign'}),e=>e.status===403);}
});


test('a stale admin reply does not reopen a user-closed ticket',async()=>{
 const f=await setup(),ticket=await f.service.control.support(f.sessions.member,{subject:'Help',message:'A request'});
 await f.service.control.closeSupport(f.sessions.member,ticket.id);
 await assert.rejects(f.run('admin','/tickets/reply',{id:ticket.id,status:'open',message:'A late reply'}),e=>e.status===409);
 assert.equal((await f.store.get('ticket:'+ticket.id)).status,'closed');
});

test('admin-created tickets are claimed, anonymous, unique and notify only their recipient',async()=>{
 const f=await setup();const body={uid:'member',subject:'Checking in',message:'Can we help?',claimedBy:'owner'};
 await assert.rejects(f.run('member','/tickets/create',body),e=>e.status===403);
 const results=await Promise.allSettled([f.run('admin','/tickets/create',body),f.run('owner','/tickets/create',body)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const id=results.find(r=>r.status==='fulfilled').value.id,row=await f.store.get('ticket:'+id);
 const sender=row.claimedBy;assert.ok(['admin','owner'].includes(sender));assert.equal(row.initialSender,'admin');
 const thread=await f.service.control.supportThread(f.sessions.member,id);assert.equal(thread.claimedBy,undefined);assert.equal(thread.initialSender,'admin');
 await assert.rejects(f.service.control.supportThread(f.sessions.admin,id),e=>e.status===404);
 await assert.rejects(f.service.control.readSupport(f.sessions.admin,{id,revision:0}),e=>e.status===404);
 assert.equal((await f.store.get('user-ticket:'+id)).userUnread,true);
 await f.run(sender,'/tickets/reply',{id,status:'open',message:'Second message'});
 await f.service.control.readSupport(f.sessions.member,{id,revision:0});assert.equal((await f.store.get('user-ticket:'+id)).userUnread,true);
 await f.service.control.readSupport(f.sessions.member,{id,revision:1});assert.equal((await f.store.get('user-ticket:'+id)).userUnread,false);
 await f.service.control.replySupport(f.sessions.member,{id,message:'Thanks'});assert.equal((await f.store.get('ticket:'+id)).adminUnread,true);
 await f.run(sender,'/tickets/reply',{id,operation:'read'});assert.equal((await f.store.get('ticket:'+id)).adminUnread,true);
 await f.run(sender,'/tickets/reply',{id,operation:'read',markRead:true});assert.equal((await f.store.get('ticket:'+id)).adminUnread,false);
});


test('admin overview uses authenticated account presence and expires at 75 seconds',async()=>{
 let now=1000;const f=await setup(()=>now),{onlineAdmins}=await import('../platform/online.mjs');
 assert.deepEqual(await onlineAdmins(f.store,now),{total:2,items:[]});
 await f.run('admin','/session');
 let data=await onlineAdmins(f.store,now);assert.equal(data.items.length,1);assert.equal(data.items[0].username,'admin');assert.equal(data.items[0].activity,'Admin console');assert.equal(data.items[0].email,undefined);
 now=1074;assert.equal((await onlineAdmins(f.store,now)).items.length,1);
 now=1075;assert.equal((await onlineAdmins(f.store,now)).items.length,0);
 await f.run('admin','/session');assert.equal((await onlineAdmins(f.store,now)).items.length,1);
 await atomic(f.store,async tx=>{const family=await tx.get('family:admin');await tx.put('family:admin',{...family,revoked:true});});
 assert.equal((await onlineAdmins(f.store,now)).items.length,0);
});
test('admin presence excludes members, removed and restricted staff, and future activity',async()=>{
 const f=await setup(),{onlineAdmins}=await import('../platform/online.mjs');
 await assert.rejects(f.run('member','/session'),e=>e.status===403);assert.equal(await f.store.get('admin-presence:member'),null);
 await f.run('admin','/session');
 await atomic(f.store,async tx=>{const u=await tx.get('user:admin');await tx.put('user:admin',{...u,status:'banned'});});assert.equal((await onlineAdmins(f.store,1000)).items.length,0);
 await atomic(f.store,async tx=>{const u=await tx.get('user:admin');await tx.put('user:admin',{...u,status:'active',browserSeenAt:1000,browserSeenEpoch:u.epoch});await tx.remove('admin-presence:admin');});
 assert.equal((await onlineAdmins(f.store,1000)).items[0].activity,'Browsing');
 await atomic(f.store,async tx=>{const u=await tx.get('user:admin');await tx.put('user:admin',{...u,browserSeenAt:1001});});assert.equal((await onlineAdmins(f.store,1000)).items.length,0);
 await f.run('owner','/staff/change',{uid:'admin',action:'remove',reason:'Test removal'});const data=await onlineAdmins(f.store,1000);assert.equal(data.total,1);assert.ok(data.items.every(u=>u.uid==='owner'));
});


test('admin username reset reserves generated name, restricts old name, and retains account access',async()=>{
 const f=await setup();await atomic(f.store,async tx=>{await tx.put('name:member',{uid:'member'});const u=await tx.get('user:member');await tx.put('user:member',{...u,usernameChangeRequired:true,usernameChangeReason:'Old reason'});});
 const result=await f.run('admin','/accounts/action',{uid:'member',action:'reset-username',reason:'Inappropriate name'});assert.equal(result.username,'grove_user_member');
 const u=await f.store.get('user:member');assert.equal(u.username,'grove_user_member');assert.equal(u.epoch,1);assert.equal(u.status,'active');assert.equal(u.usernameChangeRequired,false);assert.ok(u.disallowedUsernames.includes('member'));
 assert.equal(await f.store.get('name:member'),null);assert.equal((await f.store.get('name:grove_user_member')).uid,'member');
 assert.equal((await f.service.accounts.me(f.sessions.member)).username,'grove_user_member');
 await assert.rejects(f.service.accounts.rename(f.sessions.member,'member'),e=>e.status===400);
 const audit=(await f.store.list('audit')).items.find(x=>x.action==='reset-username');assert.equal(audit.actor,'admin');assert.equal(audit.actorUsername,'admin');
 await f.service.accounts.rename(f.sessions.member,'better_name');assert.equal(await f.store.get('name:grove_user_member'),null);
});
test('username reset cannot bypass staff permissions or overwrite a name reservation',async()=>{
 const f=await setup(),body={uid:'member',action:'reset-username',reason:'Test'};
 await assert.rejects(f.run('member','/accounts/action',body),e=>e.status===403);
 for(const uid of ['owner','admin'])await assert.rejects(f.run('admin','/accounts/action',{...body,uid}),e=>e.status===403);
 await assert.rejects(f.service.control.admin('user',{...body,uid:'owner'}),e=>e.status===403);
 await atomic(f.store,tx=>tx.put('name:grove_user_member',{uid:'someone_else'}));
 await assert.rejects(f.run('admin','/accounts/action',body),e=>e.status===409);assert.equal((await f.store.get('user:member')).username,'member');
});

test('only owner appoints head admins; head admins manage regular admins and ban them',async()=>{
 const f=await setup();await f.run('owner','/staff/change',{uid:'admin',action:'promote',reason:'Lead support'});
 assert.equal((await f.run('admin','/session')).role,'head-admin');assert.equal((await f.run('admin','/staff')).items.find(x=>x.uid==='admin').role,'head-admin');
 await f.run('admin','/staff/change',{uid:'member',action:'add',reason:'New staff'});assert.equal((await f.run('member','/session')).role,'admin');
 await f.run('admin','/staff/change',{uid:'member',action:'remove',reason:'Staff change'});await assert.rejects(f.run('member','/session'),e=>e.status===403);
 await f.run('admin','/staff/change',{uid:'member',action:'add',reason:'Restore staff'});
 await f.run('admin','/accounts/action',{uid:'member',action:'ban',reason:'Rule violation'});assert.equal((await f.store.get('user:member')).status,'banned');await assert.rejects(f.run('member','/session'),e=>e.status===401);
 const audit=await f.store.list('audit');assert.ok(audit.items.some(x=>x.action==='ban'&&x.actor==='admin'));
});
test('head admins cannot promote, alter owner or peer heads, or use other peer-admin actions',async()=>{
 const f=await setup();await f.run('owner','/staff/change',{uid:'admin',action:'promote',reason:'Lead'});
 for(const action of ['promote','demote'])await assert.rejects(f.run('admin','/staff/change',{uid:'member',action,reason:'No'}),e=>e.status===403);
 for(const action of ['add','remove'])await assert.rejects(f.run('admin','/staff/change',{uid:'owner',action,reason:'No'}),e=>e.status===403);
 await f.run('owner','/staff/change',{uid:'member',action:'promote',reason:'Second lead'});
 for(const uid of ['owner','member','admin']){await assert.rejects(f.run('admin','/accounts/action',{uid,action:'ban',reason:'No'}),e=>e.status===403);await assert.rejects(f.run('admin','/staff/change',{uid,action:'remove',reason:'No'}),e=>e.status===403);}
 await f.run('owner','/staff/change',{uid:'member',action:'demote',reason:'Regular staff'});
 await assert.rejects(f.run('admin','/accounts/action',{uid:'member',action:'reset-username',reason:'No'}),e=>e.status===403);
 await f.run('owner','/staff/change',{uid:'admin',action:'demote',reason:'Regular staff'});assert.equal((await f.run('admin','/session')).role,'admin');await assert.rejects(f.run('admin','/staff'),e=>e.status===403);await assert.rejects(f.run('admin','/accounts/action',{uid:'member',action:'ban',reason:'No'}),e=>e.status===403);
});
test('removing a head admin clears both roles and invalidates existing staff access',async()=>{
 const f=await setup();await f.run('owner','/staff/change',{uid:'admin',action:'promote',reason:'Lead'});await f.run('owner','/staff/change',{uid:'admin',action:'remove',reason:'Removed'});const roster=await f.store.get('staff-roster');assert.ok(!roster.admins.includes('admin'));assert.ok(!roster.headAdmins.includes('admin'));await assert.rejects(f.run('admin','/session'),e=>e.status===403);
});

test('stale head role cannot be resurrected by a head admin adding regular staff',async()=>{
 const f=await setup();await atomic(f.store,tx=>tx.put('staff-roster',{owner:'owner',admins:['admin'],headAdmins:['admin','member']}));
 await f.run('admin','/staff/change',{uid:'member',action:'add',reason:'Regular staff'});assert.equal((await f.run('member','/session')).role,'admin');assert.ok(!(await f.store.get('staff-roster')).headAdmins.includes('member'));
});

test('admin notifications are targeted, validated, audited and dismissible only by the recipient',async()=>{
 const f=await setup(),a=f.service.accounts;
 await assert.rejects(f.run('member','/accounts/notify',{uid:'owner',message:'hi'}),e=>e.status===403);
 for(const message of ['', 'x'.repeat(501)])await assert.rejects(f.run('admin','/accounts/notify',{uid:'member',message}),e=>e.status===400);
 const {id}=await f.run('admin','/accounts/notify',{uid:'member',message:'<b>Literal note</b>'});
 assert.deepEqual((await a.adminNotifications(f.sessions.owner)).items,[]);
 const notes=(await a.adminNotifications(f.sessions.member)).items;assert.equal(notes.length,1);assert.equal(notes[0].message,'<b>Literal note</b>');assert.equal(notes[0].uid,undefined);
 await assert.rejects(a.dismissAdminNotification(f.sessions.owner,id),e=>e.status===404);
 await a.dismissAdminNotification(f.sessions.member,id);await a.dismissAdminNotification(f.sessions.member,id);
 assert.equal((await a.adminNotifications(f.sessions.member)).items.length,0);
 assert.equal((await f.store.get('notice:'+id)).read,true);
 assert.ok((await f.store.list('audit')).items.some(x=>x.action==='notification:send'&&x.actor==='admin'));
});
test('admin notifications rate-limit the target and reject revoked senders',async()=>{
 const f=await setup();for(let i=0;i<5;i++)await f.run('admin','/accounts/notify',{uid:'member',message:'Note '+i});
 await assert.rejects(f.run('owner','/accounts/notify',{uid:'member',message:'Sixth'}),e=>e.status===429);
 await atomic(f.store,async tx=>{const row=await tx.get('family:admin');await tx.put('family:admin',{...row,revoked:true});});
 await assert.rejects(f.run('admin','/accounts/notify',{uid:'owner',message:'No'}),e=>e.status===401);
});
test('notification ack accepts the limited browse signing key without granting other internal actions',async()=>{
 const f=await setup(()=>1700000000),{signInternal,verifyInternal}=await import('../platform/internal.mjs');f.service.accounts.config.browseSecret='b'.repeat(64);
 const body='{}',path='/internal/notification-read';await verifyInternal(f.service.accounts,path,body,signInternal('b'.repeat(64),path,body,1700000000));
 await assert.rejects(verifyInternal(f.service.accounts,'/internal/vault',body,signInternal('b'.repeat(64),'/internal/vault',body,1700000000)),e=>e.status===401);
});
