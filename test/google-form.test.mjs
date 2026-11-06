import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../platform/google-form/Code.gs',import.meta.url),'utf8');
function fixture(status=200,body='{"ok":true}'){
 const values={'FROST_FORM_ID':'form','FROST_DISPENSER_ORIGIN':'https://example.com','FROST_FORMS_SECRET':'s'.repeat(64),'pending:event':JSON.stringify({at:Date.now(),payload:{email:'private@example.com',correlation:'private-code'}})},logs=[];
 const p={getProperty:k=>values[k],getProperties:()=>({...values}),deleteProperty:k=>delete values[k],setProperty:(k,v)=>values[k]=v};
 const context=vm.createContext({console:{log:x=>logs.push(x),warn:x=>logs.push(x)},PropertiesService:{getScriptProperties:()=>p},Utilities:{DigestAlgorithm:{SHA_256:1},Charset:{UTF_8:1},computeDigest:()=>[1],computeHmacSha256Signature:()=>[2]},UrlFetchApp:{fetch:()=>{if(status==='network')throw Error('private-code');return {getResponseCode:()=>status,getContentText:()=>body};}}});
 vm.runInContext(source,context);context.frostVerifiedForm=()=>{};return {context,values,logs,run:()=>context.retryFrostVerifications(),reply:(s,b)=>{status=s;body=b;}};
}
test('Apps Script deletes only acknowledged deliveries and preserves authentication/network failures for retry',()=>{
 for(const status of [401,403,429,500,'network']){
  const f=fixture(status);assert.throws(f.run,/retained/);assert.ok(f.values['pending:event']);
  assert.doesNotMatch(f.logs.join(' '),/private@example|private-code|ssssssss/);
  f.reply(200,'{"ok":true}');f.run();assert.equal(f.values['pending:event'],undefined);
 }
});
test('Apps Script refuses unexpected successful bodies and unknown errors',()=>{
 for(const [status,body] of [[200,'null'],[200,'{}'],[200,'<html>'],[400,'{"error":"unknown"}']]){
  const f=fixture(status,body);assert.throws(f.run,/retained/);assert.ok(f.values['pending:event']);
 }
});
test('Apps Script reports recognized permanent rejections and expires old requests',()=>{
 const f=fixture(400,'{"error":"Verified email does not match registration."}');f.run();assert.equal(f.values['pending:event'],undefined);assert.match(f.logs.join(' '),/email mismatch/);
 const expired=fixture();expired.values['pending:event']=JSON.stringify({at:Date.now()-21*60000,payload:{}});expired.run();assert.equal(expired.values['pending:event'],undefined);
 const broken=fixture();broken.values['pending:event']='null';broken.run();assert.equal(broken.values['pending:event'],undefined);
});
test('Google inspection failure preserves submission and blocks delivery until recovery',()=>{
 const f=fixture();f.context.frostVerifiedForm=()=>{throw Error('Google unavailable');};
 f.context.LockService={getScriptLock:()=>({waitLock(){},releaseLock(){}})};
 const event={source:{getId:()=> 'form'},response:{getId:()=> 'new',getRespondentEmail:()=> 'person@example.com',getItemResponses:()=>[{getItem:()=>({getTitle:()=> 'Frost verification code'}),getResponse:()=> 'x'.repeat(43)}]}};
 assert.throws(()=>f.context.frostFormSubmitted(event),/Google unavailable/);
 assert.ok(f.values['pending:new']);assert.ok(f.values['pending:event']);
 f.context.frostVerifiedForm=()=>{};f.run();assert.equal(f.values['pending:new'],undefined);
});
