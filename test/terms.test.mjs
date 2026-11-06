import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createPlatformService} from '../platform/http.mjs';
import {memoryStore} from './helpers/platform-store.mjs';
import {token,hash} from '../platform/security.mjs';
async function fixture(){const store=memoryStore(),config={origin:'https://account.example',endpoints:['https://browse.example'],internalSecret:'a'.repeat(64),assignedOnly:true};const service=createPlatformService({store,config,now:()=>1800000000});const access=token(),refresh=token(),uid='fr_11111111-1111-1111-1111-111111111111',fid='22222222-2222-2222-2222-222222222222';store.rows.set('user:'+uid,{uid,status:'active',epoch:1,username:'snow',devices:[fid]});store.rows.set('family:'+fid,{uid,fid,epoch:1});for(const [kind,value] of [['access',access],['refresh',refresh]])store.rows.set(kind+':'+hash(value),{uid,fid,epoch:1,scope:'account',origin:config.origin,expires:1800000900});store.rows.set('assignment:'+uid,{origin:config.endpoints[0]});for(const row of store.rows.values())row._v=1;return {...service,store,config,access,refresh,uid,fid,origin:config.endpoints[0]};}

test('browsing no longer requires a terms agreement',async()=>{const f=await fixture();assert.equal((await f.accounts.me(f.access)).terms,undefined);const binding=token(),handoff=await f.accounts.createHandoff(f.access,f.origin,binding),browse=await f.accounts.redeem(handoff.code,f.origin,binding);assert.equal((await f.accounts.checkBrowsing(browse.access,f.origin)).uid,f.uid);});
test('public terms are readable without authentication; acceptance remains retired',async()=>{
 const assets={};for(const [route,file] of [['/terms.html','public/terms.html'],['/terms.css','public/terms.css']])assets[route]={type:route.endsWith('.css')?'text/css':'text/html',body:await readFile(file,'utf8')};
 const f=await fixture(),service=createPlatformService({store:f.store,config:f.config,assets});
 for(const path of Object.keys(assets)){const r=await service.handler({rawPath:path,requestContext:{http:{method:'GET'}}});assert.equal(r.statusCode,200);assert.equal(r.body,assets[path].body);}
 assert.equal((await service.handler({rawPath:'/api/terms/accept',requestContext:{http:{method:'POST'}}})).statusCode,410);
 const html=await readFile('platform/ui/index.html','utf8');assert.doesNotMatch(html,/terms-gate|accept-terms/);assert.match(html, /Appeal this decision<\/a><a href="\/terms.html"/);
 assert.doesNotMatch(assets['/terms.html'].body,/Draft for review|<h2[^>]*>Privacy/);
});
