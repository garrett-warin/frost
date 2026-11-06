                                                                                  
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {pool,transaction} from './postgres.mjs';
const now=Math.floor(Date.now()/1000),uid='fr_'+randomUUID(),fid=randomUUID();
const token=()=>randomBytes(32).toString('base64url'),access=token(),refresh=token();
const hash=x=>createHash('sha256').update(x).digest('hex');
const settings=(await pool.query("SELECT payload FROM frost_records WHERE namespace='accounts' AND id='deployment-config'")).rows[0].payload;
assert.equal(settings.origin,'https://d2bvqh2y4lapn8.cloudfront.net');
const origin=settings.endpoints[0],account=settings.origin;
const device=randomUUID();
async function put(db,id,payload){await db.query("INSERT INTO frost_records(namespace,id,version,payload,kind,sort,expires) VALUES('accounts',$1,1,$2,$3,$1,$4)",[id,payload,payload.kind||'internal',now+3600]);}
try{
 await transaction('accounts',async db=>{
  await put(db,'user:'+uid,{uid,username:'rotation_test',email:'rotation-test@example.invalid',status:'active',epoch:0,devices:[fid],createdAt:now,expires:now+3600});
  await put(db,'family:'+fid,{uid,fid,epoch:0,revoked:false,firstSeen:now,lastActive:now,expires:now+3600});
  for(const [prefix,value] of [['access',access],['refresh',refresh]])await put(db,prefix+':'+hash(value),{uid,fid,epoch:0,scope:'account',origin:account,used:false,expires:now+3600});
  await put(db,'assignment:'+uid,{uid,origin,assignedAt:now});
 });
 const start=await fetch(origin+'/auth/start',{redirect:'manual'});assert.equal(start.status,303);
 const bindingCookie=start.headers.getSetCookie().find(x=>x.startsWith('__Host-frost-binding='));assert.ok(bindingCookie);
 const destination=new URL(start.headers.get('location'));assert.equal(destination.origin,account);
 const cookie='__Host-frost-account='+access+'; __Host-frost-refresh='+refresh;
 const bootstrap=await fetch(account+'/api/bootstrap',{headers:{cookie}});assert.equal(bootstrap.status,200);const boot=await bootstrap.json();assert.equal(boot.signedIn,true);
 const handoff=await fetch(account+'/api/handoff',{method:'POST',headers:{cookie,origin:account,'content-type':'application/json','x-frost-csrf':boot.csrf},body:JSON.stringify({origin,binding:destination.searchParams.get('binding')})});assert.equal(handoff.status,200);
 const url=(await handoff.json()).url;assert.equal(new URL(url).origin,origin);
 const callback=await fetch(url,{redirect:'manual',headers:{cookie:bindingCookie.split(';')[0]}});assert.equal(callback.status,303);assert.equal(callback.headers.get('location'),'/');
 const browseCookies=callback.headers.getSetCookie().filter(x=>x.startsWith('__Host-frost-browse')).map(x=>x.split(';')[0]).join('; ')+'; __Host-frost-device='+device;
 const main=await fetch(origin+'/',{redirect:'manual',headers:{cookie:browseCookies}});assert.equal(main.status,200);
 const check=await fetch(origin+'/api/account/status',{headers:{cookie:browseCookies}});assert.equal(check.status,200);assert.equal((await check.json()).allowed,true);
 const replay=await fetch(url,{redirect:'manual',headers:{cookie:bindingCookie.split(';')[0]}});assert.equal(replay.status,303);assert.ok(replay.headers.get('location').startsWith(account));
 const rejected=await fetch(settings.endpoints[1]+'/api/account/status',{headers:{cookie:browseCookies}});assert.notEqual(rejected.status,200);
 console.log('PASS: public account bootstrap, bound handoff, callback, authenticated new-tab access, account check, replay rejection and wrong-mirror rejection');
}finally{
 await transaction('accounts',async db=>{await db.query("DELETE FROM frost_records WHERE namespace='accounts' AND (payload->>'uid'=$1 OR id=$2 OR id=$3 OR id=$4)",[uid,'user:'+uid,'family:'+fid,'online:'+uid]);});
 await pool.end();
 console.log('Synthetic account/session rows cleaned up');
}
