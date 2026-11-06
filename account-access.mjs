import {signInternal} from './platform/internal.mjs';
import {token,hmac,isToken} from './platform/security.mjs';

                                                                              
                                                                                   
export function createAccountAccess({dispenserOrigin,internalSecret,fetchService=fetch,now=()=>Math.floor(Date.now()/1000)}){
 const parsed=new URL(dispenserOrigin);
 if(parsed.protocol!=='https:'||parsed.origin!==dispenserOrigin||internalSecret?.length<32)throw Error('Invalid account service configuration.');
 const accessName='__Host-frost-browse',refreshName='__Host-frost-browse-refresh',bindingName='__Host-frost-binding';
 const base={'Cache-Control':'no-store','Referrer-Policy':'no-referrer'};
 const cookie=(name,value,seconds)=>`${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${seconds}`;
 function read(req,name){const matches=(req.headers.cookie||'').split(';').map(c=>c.trim()).filter(c=>c.startsWith(name+'='));return matches.length===1?matches[0].slice(name.length+1):null;}
 function set(res,values){const old=res.getHeader('Set-Cookie')||[];res.setHeader('Set-Cookie',[...(Array.isArray(old)?old:[old]),...values]);}
 function clear(res){set(res,[cookie(accessName,'',0),cookie(refreshName,'',0)]);}
 function redirect(res,url){res.writeHead(303,{...base,Location:url}).end();}
 async function remote(path,body){
  const raw=JSON.stringify(body),headers=signInternal(internalSecret,path,raw,now());
  headers['x-amz-content-sha256']=(await import('node:crypto')).createHash('sha256').update(raw).digest('hex');
  const response=await fetchService(dispenserOrigin+path,{method:'POST',headers,body:raw,redirect:'error',signal:AbortSignal.timeout(6000)});
  const result=await response.json();
  if(!response.ok)throw Object.assign(new Error(result.error||'Account check failed.'),{status:response.status,code:result.code});return result;
 }
 function checked(info){
  if(!info||!/^fr_[a-f0-9-]{36}$/.test(info.uid||'')||!/^[a-f0-9-]{36}$/.test(info.fid||'')||!Number.isInteger(info.epoch)||info.epoch<0||!Number.isInteger(info.expires)||info.expires<=now())throw new Error('Invalid account service response.');
  return info;
 }
 function issued(value){if(!isToken(value?.access)||!isToken(value?.refresh)||value.expiresIn!==900||value.refreshExpiresIn!==400*86400)throw new Error('Invalid account service response.');return value;}
 const flights=new Map();
 async function credentials(req,res,origin){
  let access=read(req,accessName),info;
  if(isToken(access))try{info=checked(await remote('/internal/check',{access,origin}));return {access,...info};}catch(error){if(error.status!==401)throw error;}
  const refresh=read(req,refreshName);if(!isToken(refresh))throw Object.assign(new Error('Sign in to continue.'),{status:401});
                                                                               
                                                                                  
  const key=hmac(internalSecret,origin+':'+refresh);let pending=flights.get(key);
  if(!pending){pending=remote('/internal/refresh',{refresh,origin});flights.set(key,pending);pending.finally(()=>flights.delete(key)).catch(()=>{});}
  const next=issued(await pending);set(res,[cookie(accessName,next.access,next.expiresIn),cookie(refreshName,next.refresh,next.refreshExpiresIn)]);access=next.access;info=checked(await remote('/internal/check',{access,origin}));return {access,...info};
 }
 function deny(req,res,error){
  const restricted=error.code==='ACCOUNT_RESTRICTED',reassigned=['ASSIGNMENT_CHANGED','USERNAME_CHANGE_REQUIRED'].includes(error.code);const destination=dispenserOrigin+(restricted?'/appeal':reassigned?'/':'/?verify=1');
  if(restricted||reassigned||error.status===401){clear(res);if(!req.url.startsWith('/api/'))return redirect(res,destination);}
  const status=[400,401,403,409,413].includes(error.status)?error.status:503;
  res.writeHead(status,{...base,'Content-Type':'application/json'}).end(JSON.stringify({error:status===503?'Account service unavailable. Try again shortly.':error.message,...(restricted||reassigned||status===401?{redirect:destination}:{})}));
 }
 return {
  remote,credentials,deny,
  async connection(req,origin){const access=read(req,accessName);if(!isToken(access))throw Object.assign(new Error('Sign in to continue.'),{status:401});return checked(await remote('/internal/check',{access,origin}));},
  async handle(req,res,origin){
   const url=new URL(req.url,origin);
   try{
    if(url.pathname==='/auth/start'&&req.method==='GET'){
     const binding=token();set(res,[cookie(bindingName,binding,600)]);const target=new URL('/open',dispenserOrigin);target.searchParams.set('origin',origin);target.searchParams.set('binding',binding);redirect(res,target.href);return true;
    }
    if(url.pathname==='/auth/callback'&&req.method==='GET'){
     const code=url.searchParams.get('code'),binding=read(req,bindingName);if(!isToken(code)||!isToken(binding))throw Object.assign(new Error('Sign-in link expired. Open Grove from the dispenser again.'),{status:401});
     const next=issued(await remote('/internal/redeem',{code,binding,origin}));set(res,[cookie(accessName,next.access,next.expiresIn),cookie(refreshName,next.refresh,next.refreshExpiresIn),cookie(bindingName,'',0)]);redirect(res,'/');return true;
    }
    if(url.pathname==='/api/account/history'){
     if(req.method!=='POST'){res.writeHead(405,base).end();return true;}
     if(req.headers.origin!==origin||req.headers['content-type']?.split(';')[0]!=='application/json')throw Object.assign(new Error('Invalid history request.'),{status:403});
     const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>8192)throw Object.assign(new Error('Request too large.'),{status:413});chunks.push(chunk);}const raw=Buffer.concat(chunks).toString('utf8');
     let visit;try{visit=JSON.parse(raw);}catch{throw Object.assign(new Error('Invalid JSON.'),{status:400});}
     const auth=await credentials(req,res,origin);
     const result=await remote('/internal/history',{access:auth.access,origin,visit});
     res.writeHead(200,{...base,'Content-Type':'application/json'}).end(JSON.stringify(result));return true;
    }
    if(url.pathname==='/api/account/notification-read'){
     if(req.method!=='POST'){res.writeHead(405,base).end();return true;}
     if(req.headers.origin!==origin||req.headers['content-type']?.split(';')[0]!=='application/json')throw Object.assign(new Error('Invalid notification request.'),{status:403});
     const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>1024)throw Object.assign(new Error('Request too large.'),{status:413});chunks.push(chunk);}let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Object.assign(new Error('Invalid JSON.'),{status:400});}
     const auth=await credentials(req,res,origin);const result=await remote('/internal/notification-read',{access:auth.access,origin,id:body?.id});res.writeHead(200,{...base,'Content-Type':'application/json'}).end(JSON.stringify(result));return true;
    }
    if(url.pathname==='/api/account/design'){res.writeHead(410,base).end();return true;}
    if(url.pathname!=='/api/account/status')return false;
    if(req.method!=='GET'){res.writeHead(405,base).end();return true;}
    await credentials(req,res,origin);
    const result={allowed:true};
    res.writeHead(200,{...base,'Content-Type':'application/json'}).end(JSON.stringify(result));return true;
   }catch(error){deny(req,res,error);return true;}
  }
 };
}
