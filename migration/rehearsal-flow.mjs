                                                                                 
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes,randomUUID} from 'node:crypto';
import {request} from 'node:http';
import {pool} from './postgres.mjs';
if(!process.env.DATABASE_URL?.includes('frost-db-rehearsal'))throw Error('Rehearsal database required');
await writeFile('/app/accounts-fixture.mjs',(await readFile('/app/accounts.mjs','utf8'))+'\nexport {initialize as fixture};\n');
const {fixture}=await import('./accounts-fixture.mjs');
const service=await fixture(),accounts=service.accounts;
const token=()=>randomBytes(32).toString('base64url');
async function register(){
  const name='ovhtest_'+randomBytes(4).toString('hex'),email=name+'@example.com';
  const pending=await accounts.register({email,username:name},'ovh-rehearsal-'+name);
  await accounts.verifiedEvent({formId:accounts.config.formId,eventId:token(),email,correlation:pending.siteCode});
  const session=await accounts.completeRegistration(pending.poll,'OVH synthetic rehearsal');
  return {...session,user:await accounts.me(session.access)};
}
const a=await register(),b=await register();
const origin=accounts.config.endpoints[0];
await service.control.admin('assign',{uid:a.user.frostId,origin,reason:'Isolated migration rehearsal'});
const binding=token(),handoff=await accounts.createHandoff(a.access,origin,binding),browse=await accounts.redeem(handoff.code,origin,binding);
await assert.rejects(accounts.redeem(handoff.code,origin,binding));
const cookie='__Host-frost-browse='+browse.access+'; __Host-frost-browse-refresh='+browse.refresh+'; __Host-frost-device='+randomUUID();
const headers={host:'vps-273aa89f.vps.ovh.ca','x-frost-viewer-origin':origin,origin,cookie};
async function http(path){return new Promise((resolve,reject)=>{const req=request('http://browser:8080'+path,{headers},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,text}));});req.on('error',reject);req.end();});}
assert.equal((await http('/')).status,200);
assert.equal((await http('/api/device')).status,200);
const health=JSON.parse((await http('/api/server-health')).text);assert.equal(health.servers.length,1);assert.equal(health.servers[0].status,'healthy');
const saved={revision:0,tabs:[{id:'test-tab',title:'Synthetic',url:'https://example.com/'}],activeId:'test-tab',cookies:JSON.stringify({one:{name:'test',value:'synthetic-cookie',domain:'.example.com',path:'/'}})};
await service.vault.sync(a.access,saved);
assert.equal((await service.vault.sync(a.access)).tabs[0].url,'https://example.com/');
assert.deepEqual((await service.vault.sync(b.access)).tabs,[]);
await assert.rejects(service.vault.sync(a.access,saved));
const socket=await new Promise((resolve,reject)=>{
  const req=request('http://browser:8080/relay/',{headers:{...headers,connection:'Upgrade',upgrade:'websocket','sec-websocket-version':'13','sec-websocket-key':randomBytes(16).toString('base64')} });
  req.on('upgrade',(res,socket)=>{assert.equal(res.statusCode,101);socket.resume();resolve(socket);});
  req.on('response',res=>{res.resume();reject(Error('Relay refused: '+res.statusCode));});req.on('error',reject);req.end();
});
const closed=new Promise((resolve,reject)=>{const timer=setTimeout(()=>{socket.destroy();reject(Error('Ban did not close relay'));},22000);socket.once('close',()=>{clearTimeout(timer);resolve();});});
await service.control.admin('user',{uid:a.user.frostId,action:'ban',reason:'Synthetic migration ban check'});
assert.equal((await http('/api/device')).status,403);
await closed;
await assert.rejects(service.vault.sync(a.access));
await pool.end();
console.log('PASS: synthetic verified registration, handoff/replay, browser access, one-server health, encrypted tabs/cookies, account isolation, revision conflict, WebSocket upgrade and active ban disconnection');
