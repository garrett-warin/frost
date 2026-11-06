import test from 'node:test';
import assert from 'node:assert/strict';
import {settingsForAccountHost} from '../platform/config.mjs';
import {createPlatformService} from '../platform/http.mjs';
import {memoryStore} from './helpers/platform-store.mjs';
import {token,hash} from '../platform/security.mjs';
test('account aliases preserve host-specific sessions and strict request origins',()=>{
 const settings={origin:'https://new.example',accountAliases:['https://old.example'],endpoints:['https://browse.example']};
 assert.equal(settingsForAccountHost(settings,'new.example').origin,settings.origin);
 assert.equal(settingsForAccountHost(settings,'old.example').origin,'https://old.example');
 assert.equal(settingsForAccountHost(settings,'').origin,settings.origin);
 assert.equal(settings.origin,'https://new.example');
 for(const host of ['evil.example','new.example.evil','new.example:443','https://new.example'])assert.throws(()=>settingsForAccountHost(settings,host));
 assert.throws(()=>settingsForAccountHost({...settings,accountAliases:['http://old.example']},''));
 assert.throws(()=>settingsForAccountHost({...settings,accountAliases:[settings.origin]},''));
});
test('old and new account services share users but keep session origins separate',async()=>{
 const store=memoryStore(),now=()=>1800000000,settings={origin:'https://new.example',accountAliases:['https://old.example'],endpoints:['https://browse.example']};
 const make=host=>createPlatformService({store,now,config:{...settingsForAccountHost(settings,host),internalSecret:'a'.repeat(64)}});
 const old=make('old.example'),fresh=make('new.example'),uid='fr_11111111-1111-1111-1111-111111111111',fid='22222222-2222-2222-2222-222222222222';
 store.rows.set('user:'+uid,{uid,username:'synthetic',status:'active',epoch:1,devices:[fid],_v:1});store.rows.set('family:'+fid,{fid,uid,epoch:1,_v:1});
 const oldAccess=token(),newAccess=token(),refresh=token();
 for(const [kind,value,origin] of [['access',oldAccess,settings.accountAliases[0]],['access',newAccess,settings.origin],['refresh',refresh,settings.accountAliases[0]]])store.rows.set(kind+':'+hash(value),{uid,fid,epoch:1,scope:'account',origin,expires:now()+900,_v:1});
 assert.equal((await old.accounts.me(oldAccess)).username,'synthetic');assert.equal((await fresh.accounts.me(newAccess)).frostId,uid);
 await assert.rejects(fresh.accounts.me(oldAccess));await assert.rejects(fresh.accounts.refresh(refresh));
 assert.ok((await old.accounts.refresh(refresh)).access);
 const response=await fresh.handler({rawPath:'/api/preferences',requestContext:{http:{method:'POST'}},headers:{origin:'https://old.example','content-type':'application/json'},body:'{}'});
 assert.equal(response.statusCode,403);
});
