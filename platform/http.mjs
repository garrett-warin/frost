import {createBrowsingHistory} from './browsing-history.mjs';
import {createStaff,staffRole,staffKey} from './staff.mjs';
import {importResponses} from './verification-responses.mjs';
import {createAccounts} from './accounts.mjs';
import {createControl} from './control.mjs';
import {createDesigns} from './designs.mjs';
import {createVault} from './vault.mjs';
import {verifyInternal} from './internal.mjs';
import {atomic} from './store.mjs';
import {isIP} from 'node:net';
import {equal,hmac,hash,requireThat,Problem} from './security.mjs';

const names={access:'__Host-frost-account',refresh:'__Host-frost-refresh',poll:'__Host-frost-registration'};
export function parseCookies(values){
 const result=Object.create(null);
 for(const part of values.join(';').split(';')){const index=part.indexOf('=');if(index<0)continue;const name=part.slice(0,index).trim();requireThat(!Object.hasOwn(result,name),400,'Duplicate cookie.');result[name]=part.slice(index+1).trim();}
 return result;
}
const cookie=(name,value,seconds)=>`${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${seconds}`;
export function createPlatformService({store,config,assets={},now,legacyAdmin}){
 const accounts=createAccounts({store,config,now}),control=createControl(accounts),vault=createVault(accounts);
 const browsingHistory=createBrowsingHistory(accounts);
 const staff=createStaff(accounts,{legacyAdmin}),designs=createDesigns(accounts);
 const base={'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-frame-options':'DENY','cross-origin-opener-policy':'same-origin','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"};
 const response=(statusCode,value,cookies=[])=>({statusCode,headers:{...base,'content-type':'application/json; charset=utf-8'},cookies,body:JSON.stringify(value)});
 const redirect=(location,cookies=[])=>({statusCode:303,headers:{...base,location},cookies,body:''});
 const sessions=session=>[cookie(names.access,session.access,session.expiresIn),cookie(names.refresh,session.refresh,session.refreshExpiresIn)];
 const clear=()=>[cookie(names.access,'',0),cookie(names.refresh,'',0)];
 async function handler(event){
  try{
   const method=event.requestContext?.http?.method||'GET',path=event.rawPath||'/',headers=Object.fromEntries(Object.entries(event.headers||{}).map(([k,v])=>[k.toLowerCase(),v]));
   requireThat(['GET','POST'].includes(method),405,'Method not allowed.');
   const raw=event.isBase64Encoded?Buffer.from(event.body||'','base64').toString('utf8'):event.body||'';
   requireThat(Buffer.byteLength(raw)<=280*1024,413,'Request too large.');
   let body={};if(raw){try{body=JSON.parse(raw);}catch{throw new Problem(400,'Invalid JSON.');}requireThat(body&&typeof body==='object'&&!Array.isArray(body),400,'Invalid request.');}
   const query=new URLSearchParams(event.rawQueryString||''),cookies=parseCookies(event.cookies||[headers.cookie||'']),access=cookies[names.access];
   const viewerAddress=config.trustCloudFront?headers['cloudfront-viewer-address']:event.requestContext?.http?.sourceIp;
   const viewerIp=isIP(viewerAddress||'')?viewerAddress:viewerAddress?.startsWith('[')?viewerAddress.slice(1,viewerAddress.indexOf(']')):viewerAddress?.replace(/:\d+$/,'');
   if(path.startsWith('/internal/')){
    requireThat(method==='POST',405,'Method not allowed.');await verifyInternal(accounts,path,raw,headers);
    requireThat(config.endpoints.includes(body.origin),400,'Unregistered endpoint.');
    let result;
    if(path==='/internal/redeem')result=await accounts.redeem(body.code,body.origin,body.binding);
    else if(path==='/internal/refresh')result=await accounts.refresh(body.refresh,'browse',body.origin);
    else if(path==='/internal/check')result=await accounts.checkBrowsing(body.access,body.origin);
    else if(path==='/internal/connection')result=await accounts.checkConnection(body.grant,body.origin);
    else if(path==='/internal/history')result=await browsingHistory.record(body.access,body.origin,body.visit);
    else if(path==='/internal/design')result=await designs.published(body.access,body.origin);
    else if(path==='/internal/vault')result=await vault.sync(body.access,body.value,{scope:'browse',origin:body.origin});
    else if(path==='/internal/preferences')result=await accounts.preferences(body.access,body.value,{scope:'browse',origin:body.origin});
    else throw new Problem(404,'Not found.');
    return response(200,result);
   }
   if(path==='/forms/verified'||path==='/forms/responses'){
    requireThat(method==='POST'&&config.formsSecret?.length>=32,401,'Verification unavailable.');
    const timestamp=headers['x-frost-time'];requireThat(/^\d{10}$/.test(timestamp||'')&&Math.abs(accounts.now()-Number(timestamp))<=300&&equal(headers['x-frost-signature'],hmac(config.formsSecret,`${timestamp}\n${path==='/forms/responses'?path+'\n':''}${hash(raw)}`)),401,'Invalid verification signature.');
    return response(200,path==='/forms/responses'?await importResponses(accounts,body):await accounts.verifiedEvent(body));
   }
   if(method==='POST'){
    requireThat(headers.origin===config.origin&&headers['content-type']?.split(';')[0]==='application/json',403,'Open the dispenser to make this request.');
    if(!['/api/register','/api/verify','/api/entry'].includes(path)){
     const bootstrap=await accounts.bootstrap(cookies[names.refresh]);
     // Registration completion is bound to an unguessable HttpOnly poll cookie.
     if(path!=='/api/register/complete'){requireThat(bootstrap.signedIn,401,'Verify your email again at the dispenser.');requireThat(equal(headers['x-frost-csrf'],bootstrap.csrf),403,'Refresh this page before continuing.');}
    }
   }
   if(['/api/verify','/api/username','/api/register','/api/entry'].includes(path)){
    // CloudFront must overwrite this viewer header and the Lambda URL must be OAC-only.
    requireThat(isIP(viewerIp||''),503,'Request origin could not be verified.');
    await atomic(store,async tx=>{await accounts.rate(tx,'public:'+path+':'+hmac(config.internalSecret,viewerIp),30,60);await accounts.rate(tx,'public-global:'+path,500,60);});
   }
   if(method==='GET'&&path==='/api/bootstrap')return response(200,{...await accounts.bootstrap(cookies[names.refresh]),registrationReady:!!(config.formUrl&&config.formId&&config.formsSecret)});
   if(method==='POST'&&path==='/api/register'){const result=await accounts.register(body,viewerIp);return response(200,{formUrl:result.formUrl,siteCode:result.siteCode,expiresIn:result.expiresIn},[cookie(names.poll,result.poll,900)]);}
   if(method==='GET'&&path==='/api/register/status')return response(200,await accounts.registrationStatus(cookies[names.poll]));
   if(method==='POST'&&path==='/api/register/complete'){const session=await accounts.completeRegistration(cookies[names.poll],headers['user-agent'],access,body);return response(200,{ok:true,csrf:session.csrf,emailChanged:!!session.emailChanged},[...(session.emailChanged?clear():sessions(session)),cookie(names.poll,'',0)]);}
   if(method==='GET'&&path==='/api/username')return response(200,{available:await accounts.available(query.get('name'))});
   if(method==='POST'&&['/api/verify','/api/email','/api/entry'].includes(path)){const result=await accounts.startVerification({...body,purpose:path==='/api/email'?'email':path==='/api/entry'?'entry':'login'},viewerIp,access);return response(200,{formUrl:result.formUrl,siteCode:result.siteCode,expiresIn:result.expiresIn},[cookie(names.poll,result.poll,900)]);}
   if(method==='POST'&&path==='/api/refresh'){const session=await accounts.refresh(cookies[names.refresh]);return response(200,{ok:true,csrf:session.csrf},sessions(session));}
   if(method==='POST'&&path==='/api/terms/accept')return response(200,await accounts.acceptTerms(access,body));
   if(method==='GET'&&path==='/api/me'){const me=await accounts.me(access);return response(200,{...me,role:me.status==='active'?staffRole(await store.get(staffKey),me.frostId):'member'});}
   if(path.startsWith('/api/admin/')){requireThat(method==='POST',405,'POST required.');return response(200,await staff.run(access,path.slice('/api/admin'.length),body,headers['x-frost-csrf']));}
   if(method==='GET'&&path==='/api/devices')return response(200,await accounts.devices(access));
   if(method==='POST'&&path==='/api/devices')return response(200,await accounts.deviceAction(access,body),body.action==='logout'?clear():[]);
   if(method==='POST'&&path==='/api/username')return response(200,await accounts.rename(access,body.username));
   if(path==='/api/design')return response(200,method==='GET'?await designs.read(access):await designs.write(access,body));
   if(path==='/api/templates'&&method==='POST')return response(200,await designs.gallery(access,body));
   if(path==='/api/templates/publish'&&method==='POST')return response(200,await designs.publish(access,body));
   if(path==='/api/templates/report'&&method==='POST')return response(200,await designs.report(access,body));
   if(path==='/api/preferences')return response(200,await accounts.preferences(access,method==='POST'?body:undefined));
   if(method==='GET'&&path==='/api/assignment')return response(200,await control.assignment(access));
   if(method==='POST'&&path==='/api/assignment')return response(200,await control.allocate(access));
   if(method==='POST'&&path==='/api/handoff'){const result=await accounts.createHandoff(access,body.origin,body.binding);return response(200,{url:body.origin+'/auth/callback?code='+encodeURIComponent(result.code)});}
   if(method==='POST'&&path==='/api/reports')return response(200,await control.report(access,body));
   if(method==='POST'&&path==='/api/support')return response(200,await control.support(access,body));
   if(method==='GET'&&path==='/api/restriction')return response(200,await control.restriction(access));
   if(method==='POST'&&path==='/api/notifications/read')return response(200,await control.readNotice(access,body.id));
   if(method==='POST'&&path==='/api/delete'){const me=await accounts.me(access);requireThat(staffRole(await store.get(staffKey),me.frostId)!=='owner',403,'The owner account cannot be deleted.');return response(200,await control.deleteAccount(access),clear());}
   const lists={'/api/notifications':'notices','/api/security':'security','/api/reports':'reports','/api/support':'tickets','/api/assignment-history':'assignments'};
   if(method==='GET'&&lists[path])return response(200,await control.ownedList(access,lists[path],query.get('cursor')||undefined));
   if(method==='GET'&&path==='/health')return response(200,{ok:true,service:'frost-dispenser'});
   const asset=assets[path]||(['/', '/appeal','/open'].includes(path)?assets['/index.html']:null);
   if(method==='GET'&&asset)return {statusCode:200,headers:{...base,'content-type':asset.type},body:asset.body};
   return response(404,{error:'Not found.'});
  }catch(error){const result=response(error instanceof Problem?error.status:503,{error:error instanceof Problem?error.message:'Account service is unavailable. Please try again.',...(['ACCOUNT_RESTRICTED','ASSIGNMENT_CHANGED','USERNAME_CHANGE_REQUIRED','TERMS_ACCEPTANCE_REQUIRED'].includes(error.code)?{code:error.code,redirect:config.origin+(error.code==='ACCOUNT_RESTRICTED'?'/appeal':'/')}:{}),...(error instanceof Problem&&error.status===429&&Number.isInteger(error.retryAfter)?{retryAfter:error.retryAfter}:{})});if(error instanceof Problem&&error.status===429&&Number.isInteger(error.retryAfter))result.headers['retry-after']=String(error.retryAfter);return result;}
 }
 return {handler,accounts,control,vault,designs,browsingHistory};
}
