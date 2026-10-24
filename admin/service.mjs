import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { TOTP, Secret } from 'otpauth';
import QRCode from 'qrcode';
import { validDevice } from '../device-access.mjs';
const digest = value => createHash('sha256').update(value).digest('hex');
const equal = (a,b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a),Buffer.from(b));
export function totp(secret) { return new TOTP({issuer:'Frost',label:'Developer',algorithm:'SHA1',digits:6,period:30,secret:Secret.fromBase32(secret)}); }
export function createAdminService({store,assets,setupHash,now=Date.now}) {
 const reply=(statusCode,data,type='application/json')=>({statusCode,headers:{'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY','cross-origin-opener-policy':'same-origin','content-security-policy':"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"},body:type==='application/json'?JSON.stringify(data):data});
 return async event=>{
  try {
   const path=event.rawPath || '/', method=event.requestContext.http.method;
   const headers=event.headers || {};
   if(method==='GET' && path.startsWith('/device/check/')) {
    const id=path.slice('/device/check/'.length);
    if(!validDevice(id))return reply(400,{error:'Invalid device code.'});
    return reply(200,{banned:!!await store.get('ban:'+id)});
   }
   if(method==='GET' && path==='/announcement') return reply(200,{message:(await store.get('announcement'))?.message || ''});
   if(method==='GET' && Object.hasOwn(assets,path)) return reply(200,assets[path].body,assets[path].type);
   if(method!=='POST') return reply(405,{error:'Method not allowed.'});
   const config=await store.get('config');
   if(!config?.origin || headers.origin!==config.origin) return reply(403,{error:'Invalid origin.'});
   if(!String(headers['content-type']||'').startsWith('application/json')) return reply(415,{error:'JSON required.'});
   const raw=event.isBase64Encoded?Buffer.from(event.body||'','base64').toString():event.body||'{}';
   if(Buffer.byteLength(raw)>4096) return reply(413,{error:'Request too large.'});
   let body; try {body=JSON.parse(raw);} catch {return reply(400,{error:'Invalid JSON.'});}
   if(!body || typeof body!=='object') return reply(400,{error:'Invalid request.'});
   const setupPath=path==='/setup/start'||path==='/setup/confirm';
   if(setupPath){
    if(!setupHash || !equal(digest(headers['x-frost-setup']||''),setupHash)) return reply(403,{error:'Invalid setup link.'});
    let auth=await store.get('auth');
    if(auth?.enrolled) return reply(409,{error:'Authenticator is already enrolled.'});
    if(!auth){await store.create('auth',{secret:new Secret({size:20}).base32,enrolled:false});auth=await store.get('auth');}
    if(path==='/setup/start') return reply(200,{qr:await QRCode.toDataURL(totp(auth.secret).toString()),secret:auth.secret});
   }
   if(path==='/login'||path==='/setup/confirm'){
    if(!await store.attempt(Math.floor(now()/60000))) return reply(429,{error:'Too many attempts. Wait one minute.'});
    const auth=await store.get('auth');
    if(!auth || (path==='/login'&&!auth.enrolled)) return reply(403,{error:'Admin access has not been enrolled.'});
    const delta=/^\d{6}$/.test(body.code)?totp(auth.secret).validate({token:body.code,timestamp:now(),window:1}):null;
    if(delta===null) return reply(401,{error:'Invalid authenticator code.'});
    const counter=Math.floor(now()/30000)+delta;
    if(!await store.consume(counter,path==='/setup/confirm')) return reply(401,{error:'This code was already used. Wait for a fresh code.'});
    const session=randomBytes(32).toString('base64url');
    await store.put('session:'+digest(session),{expires:Math.floor(now()/1000)+900});
    return reply(200,{session,expiresIn:900});
   }
   const token=headers['x-frost-session'] || '';
   const session=/^[A-Za-z0-9_-]{43}$/.test(token)?await store.get('session:'+digest(token)):null;
   if(!session || session.expires<=Math.floor(now()/1000)) return reply(401,{error:'Sign in with a fresh authenticator code.'});
   if(path==='/logout'){await store.remove('session:'+digest(token));return reply(200,{ok:true});}
   if(['/device/ban','/device/unban','/device/status'].includes(path)) {
    if(!validDevice(body.device))return reply(400,{error:'Enter a complete device code from Frost.'});
    const key='ban:'+body.device;
    if(path==='/device/ban') {
     if(typeof body.reason!=='string'||body.reason.length>200)return reply(400,{error:'Keep the private note under 200 characters.'});
     await store.put(key,{reason:body.reason.trim(),updatedAt:now()});
    }
    if(path==='/device/unban')await store.remove(key);
    const ban=await store.get(key);
    return reply(200,{banned:!!ban,reason:ban?.reason||''});
   }
   if(path==='/publish'){
    if(typeof body.message!=='string'||body.message.length>1000) return reply(400,{error:'Use at most 1,000 characters.'});
    await store.put('announcement',{message:body.message.trim(),updatedAt:now()});
    return reply(200,{ok:true});
   }
   return reply(404,{error:'Not found.'});
  } catch { return reply(503,{error:'Admin service unavailable. Try again shortly.'}); }
 };
}
