import {atomic} from './store.mjs';
import {requireThat,emailAddress} from './security.mjs';
export const responseSheetId='1Q_M7yfHg4A6tiDBQhXwLUTnrVFNSkTGSxir3qDt8Too';
export async function importResponses(accounts,body){
 const {store,now,config}=accounts;
 requireThat(body.kind==='sheet-responses-v1'&&body.sheetId===responseSheetId&&body.formId===config.formId,400,'Unexpected response source.');
 requireThat(Number.isSafeInteger(body.capturedAt)&&Math.abs(now()*1000-body.capturedAt)<=300000,400,'Snapshot expired.');
 requireThat(Number.isSafeInteger(body.total)&&body.total>=0&&Array.isArray(body.rows)&&body.rows.length<=100&&body.rows.length<=body.total,400,'Invalid response snapshot.');
 const seen=new Set();
 const rows=body.rows.map(row=>{
  requireThat(row&&typeof row==='object'&&!Array.isArray(row),400,'Invalid response row.');
  requireThat(Number.isSafeInteger(row.row)&&row.row>=2&&!seen.has(row.row),400,'Invalid response row.');seen.add(row.row);
  requireThat(typeof row.submittedAt==='string'&&row.submittedAt.length<=80&&typeof row.codeSuffix==='string'&&/^[A-Za-z0-9_-]{0,6}$/.test(row.codeSuffix),400,'Invalid response fields.');
  return {row:row.row,submittedAt:row.submittedAt,email:emailAddress(row.email),codeSuffix:row.codeSuffix};
 });
 return atomic(store,async tx=>{
  const prior=await tx.get('verification-responses');
  if(prior&&prior.capturedAt>=body.capturedAt)return {ok:true,ignored:true};
  await tx.put('verification-responses',{sheetId:responseSheetId,total:body.total,rows,capturedAt:body.capturedAt,syncedAt:now(),expires:now()+7*86400});return {ok:true};
 });
}
export async function readResponses(accounts){
 const row=await accounts.store.get('verification-responses');
 if(!row||row.expires<=accounts.now())return {connected:false,rows:[],total:0};
 return {connected:true,total:row.total,rows:row.rows,capturedAt:row.capturedAt,syncedAt:row.syncedAt,stale:accounts.now()-row.syncedAt>900};
}
