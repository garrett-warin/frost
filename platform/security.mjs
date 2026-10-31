import {randomBytes,randomUUID,createHash,createHmac,timingSafeEqual} from 'node:crypto';
export const token=()=>randomBytes(32).toString('base64url');
export const frostId=()=>`fr_${randomUUID()}`;
export const hash=value=>createHash('sha256').update(String(value)).digest('hex');
export const hmac=(key,value)=>createHmac('sha256',key).update(value).digest('hex');
export const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export const isToken=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
export class Problem extends Error {constructor(status,message,code){super(message);this.status=status;if(code)this.code=code;}}
export function requireThat(condition,status,message){if(!condition)throw new Problem(status,message);}
export function emailAddress(value){
 requireThat(typeof value==='string',400,'Enter an email address.');
 const email=value.trim().toLowerCase();
 requireThat(email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),400,'Enter a valid email address.');
 return email;
}
export function username(value){
 requireThat(typeof value==='string'&&/^[a-zA-Z0-9_-]{3,24}$/.test(value),400,'Use 3–24 letters, numbers, underscores or hyphens.');
 const name=value.toLowerCase();
 requireThat(!['admin','administrator','frost','frosty','developer','support','moderator','official','root','system','staff'].some(word=>name===word||name.startsWith(word+'_')||name.startsWith(word+'-')),400,'Choose a different username.');
 return name;
}
export function plain(value,max,label='Text') {requireThat(typeof value==='string'&&value.trim().length>0&&value.length<=max,400,`${label} must contain 1–${max} characters.`);return value.trim();}
export function deviceInfo(userAgent=''){
 const ua=String(userAgent).slice(0,512);
 const browser=/Edg\//.test(ua)?'Edge':/Firefox\//.test(ua)?'Firefox':/Chrome\//.test(ua)?'Chrome':/Safari\//.test(ua)?'Safari':'Browser';
 const os=/Android/.test(ua)?'Android':/iPhone|iPad/.test(ua)?'iOS':/Windows/.test(ua)?'Windows':/Macintosh/.test(ua)?'macOS':/Linux/.test(ua)?'Linux':'Unknown OS';
 return {browser,os,type:/iPad|Tablet/.test(ua)?'tablet':/Mobile|iPhone|Android/.test(ua)?'phone':'computer',label:`${browser} on ${os}`};
}
export function approvedOrigin(value,allowed){requireThat(typeof value==='string'&&allowed.includes(value),400,'Choose a registered Frost endpoint.');return value;}
export function cleanPreferences(value){
 requireThat(value&&typeof value==='object'&&!Array.isArray(value),400,'Invalid preferences.');
 requireThat(Object.keys(value).every(k=>['accentIntensity','reducedMotion','language'].includes(k)),400,'Only appearance, motion and language can be synchronized.');
 const result={};
 if(value.accentIntensity!==undefined){requireThat(Number.isFinite(value.accentIntensity)&&value.accentIntensity>=0&&value.accentIntensity<=100,400,'Invalid accent intensity.');result.accentIntensity=value.accentIntensity;}
 if(value.reducedMotion!==undefined){requireThat(typeof value.reducedMotion==='boolean',400,'Invalid motion preference.');result.reducedMotion=value.reducedMotion;}
 if(value.language!==undefined){requireThat(['en','es','fr','de','pt'].includes(value.language),400,'Unsupported language preference.');result.language=value.language;}
 return result;
}
