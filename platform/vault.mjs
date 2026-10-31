import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {atomic} from './store.mjs';
import {requireThat} from './security.mjs';

const MAX_BYTES=200*1024;
function object(value){return value&&typeof value==='object'&&!Array.isArray(value);}
function pageUrl(value){
 requireThat(typeof value==='string'&&value.length<=4096,400,'Invalid saved URL.');
 if(!value)return '';
 let parsed;try{parsed=new URL(value);}catch{requireThat(false,400,'Invalid saved URL.');}
 requireThat(['http:','https:'].includes(parsed.protocol)&&!parsed.username&&!parsed.password,400,'Only web pages can be saved.');
 return parsed.href;
}
export function cleanTabs(value){
 requireThat(object(value)&&Array.isArray(value.tabs)&&value.tabs.length<=24,400,'Save up to 24 tabs.');
 const ids=new Set();
 const tabs=value.tabs.map(tab=>{
  requireThat(object(tab)&&typeof tab.id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(tab.id)&&!ids.has(tab.id),400,'Invalid tab identifier.');ids.add(tab.id);
  requireThat(typeof tab.title==='string'&&tab.title.length<=120,400,'Invalid tab title.');
  const url=pageUrl(tab.url);
  // Navigation history, favicons, page text and arbitrary properties are never synced.
  return {id:tab.id,title:tab.title,url,home:tab.home===true||!url};
 });
 requireThat(value.activeId===null&&tabs.length===0||ids.has(value.activeId),400,'Choose an existing active tab.');
 return {tabs,activeId:value.activeId};
}
export function cleanCookies(value,now=Date.now()){
 requireThat(typeof value==='string'&&Buffer.byteLength(value)<=MAX_BYTES,400,'Cookie storage is too large.');
 let parsed;try{parsed=JSON.parse(value);}catch{requireThat(false,400,'Invalid cookie storage.');}
 requireThat(object(parsed)&&Object.keys(parsed).length<=500,400,'Too many saved cookies.');
 const cookies=Object.create(null);
 for(const cookie of Object.values(parsed)){
  requireThat(object(cookie),400,'Invalid saved cookie.');
  const {name,value:content,domain,path}=cookie;
  requireThat(typeof name==='string'&&name.length<=256&&!/[\x00-\x20\x7f;=]/.test(name)&&typeof content==='string'&&content.length<=8192&&!/[\x00-\x1f\x7f]/.test(content),400,'Invalid cookie value.');
  requireThat(typeof domain==='string'&&domain.length<=254&&/^\.?[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(domain)&&!domain.includes('..'),400,'Invalid cookie domain.');
  requireThat(typeof path==='string'&&path.startsWith('/')&&path.length<=2048&&!/[\x00-\x1f\x7f]/.test(path),400,'Invalid cookie path.');
  const cleaned={name,value:content,domain:domain.toLowerCase(),path};
  for(const field of ['hostOnly','secure','httpOnly'])if(cookie[field]!==undefined){requireThat(typeof cookie[field]==='boolean',400,'Invalid cookie flag.');cleaned[field]=cookie[field];}
  if(cookie.sameSite!==undefined){requireThat(typeof cookie.sameSite==='string'&&['strict','lax','none'].includes(cookie.sameSite.toLowerCase()),400,'Invalid SameSite attribute.');cleaned.sameSite=cookie.sameSite;}
  if(cookie.expires!==undefined){const expires=typeof cookie.expires==='string'?Date.parse(cookie.expires):cookie.expires;requireThat(Number.isFinite(expires),400,'Invalid cookie expiration.');if(expires<=now)continue;cleaned.expires=expires;}
  if(cookie.maxAge!==undefined){requireThat(Number.isFinite(cookie.maxAge),400,'Invalid cookie lifetime.');cleaned.maxAge=cookie.maxAge;}
  cookies[`${cleaned.domain}@${path}@${name}`]=cleaned;
 }
 return JSON.stringify(cookies);
}

export function createVault(accounts){
 const {store,config,now,authorize}=accounts;
 // Provision a dedicated random 256-bit key; never derive it from public IDs.
 const key=Buffer.from(config.vaultKey||'','base64');
 const ready=()=>requireThat(key.length===32,503,'Account storage is not configured yet.');
 const aad=uid=>Buffer.from('frost-account-vault:v1:'+uid);
 function seal(uid,value){
  const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce);cipher.setAAD(aad(uid));
  const data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
  return {format:1,nonce:nonce.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')};
 }
 function open(uid,encrypted){
  requireThat(encrypted?.format===1,503,'Saved account data is unavailable.');
  try{const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(encrypted.nonce,'base64'));decipher.setAAD(aad(uid));decipher.setAuthTag(Buffer.from(encrypted.tag,'base64'));return JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted.data,'base64')),decipher.final()]).toString('utf8'));}
  catch{requireThat(false,503,'Saved account data could not be verified.');}
 }
 return {
  async sync(access,body,options){
   ready();
   return atomic(store,async tx=>{
    const {user,session}=await authorize(tx,access,options);
    if(session.scope==='browse'&&config.assignedOnly){const assignment=await tx.get('assignment:'+user.uid);requireThat(assignment?.origin===session.origin,403,'Use your assigned Frost endpoint.');}
    const id='vault:'+user.uid,row=await tx.get(id),revision=row?.revision||0;
    const current=row?open(user.uid,row.encrypted):{tabs:[],activeId:null,cookies:'{}'};
    if(body===undefined)return {...current,cookies:cleanCookies(current.cookies,now()*1000),revision,updatedAt:row?.updatedAt||null};
    requireThat(object(body)&&Object.keys(body).every(k=>['revision','tabs','activeId','cookies'].includes(k)),400,'Invalid account storage request.');
    requireThat(Number.isSafeInteger(body.revision)&&body.revision===revision,409,'Saved tabs changed on another device. Reload them before saving.');
    const tabs=body.tabs===undefined?{tabs:current.tabs,activeId:current.activeId}:cleanTabs(body);
    const cookies=body.cookies===undefined?current.cookies:cleanCookies(body.cookies,now()*1000);
    const next={...tabs,cookies};requireThat(Buffer.byteLength(JSON.stringify(next))<=MAX_BYTES,413,'Saved account storage is full.');
    const updatedAt=now();await tx.put(id,{uid:user.uid,revision:revision+1,updatedAt,encrypted:seal(user.uid,next)});
    return {revision:revision+1,updatedAt};
   });
  }
 };
}
