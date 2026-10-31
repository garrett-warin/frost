import {cleanMaintenance} from './maintenance.mjs';
import {validDevice} from '../device-access.mjs';
import {LambdaClient,InvokeCommand} from '@aws-sdk/client-lambda';
import { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { createAdminService } from './service.mjs';
import { assets } from './assets.mjs';
const client=new DynamoDBClient({}); const TableName=process.env.TABLE_NAME;
const key=id=>({id:{S:id}});
const encode=value=>Object.fromEntries(Object.entries(value).map(([k,v])=>[k,typeof v==='number'?{N:String(v)}:typeof v==='boolean'?{BOOL:v}:{S:v}]));
const decode=item=>item&&Object.fromEntries(Object.entries(item).map(([k,v])=>[k,v.S??(v.N!==undefined?Number(v.N):v.BOOL)]));
const conditional=async command=>{try{await client.send(command);return true;}catch(e){if(e.name==='ConditionalCheckFailedException')return false;throw e;}};
const store={
 async get(id){return decode((await client.send(new GetItemCommand({TableName,Key:key(id),ConsistentRead:true}))).Item);},
 async put(id,value){await client.send(new PutItemCommand({TableName,Item:{...key(id),...encode(value)}}));},
 async create(id,value){return conditional(new PutItemCommand({TableName,Item:{...key(id),...encode(value)},ConditionExpression:'attribute_not_exists(id)'}));},
 async remove(id){await client.send(new DeleteItemCommand({TableName,Key:key(id)}));},
 async attempt(minute){return conditional(new UpdateItemCommand({TableName,Key:key('attempt:'+minute),UpdateExpression:'SET expires = :expiry ADD attempts :one',ConditionExpression:'attribute_not_exists(attempts) OR attempts < :limit',ExpressionAttributeValues:{':expiry':{N:String(minute*60+120)},':one':{N:'1'},':limit':{N:'5'}}}));},
 async consume(counter,enroll){return conditional(new UpdateItemCommand({TableName,Key:key('auth'),UpdateExpression:'SET lastCounter = :counter'+(enroll?', enrolled = :yes':''),ConditionExpression:'attribute_not_exists(lastCounter) OR lastCounter < :counter',ExpressionAttributeValues:{':counter':{N:String(counter)},...(enroll?{':yes':{BOOL:true}}:{})}}));}
};
const lambda=new LambdaClient({});
async function owner(action,body={}){
 if(!process.env.ACCOUNT_FUNCTION)return {statusCode:503,data:{error:'Account controls are not connected yet.'}};
 const result=await lambda.send(new InvokeCommand({FunctionName:process.env.ACCOUNT_FUNCTION,Payload:Buffer.from(JSON.stringify({source:'frost.admin',action,body}))}));
 if(result.FunctionError)throw Error('Account service unavailable');
 const value=JSON.parse(Buffer.from(result.Payload).toString());
 if(!Number.isInteger(value.statusCode)||!value.data)throw Error('Invalid account response');return value;
}
const service=createAdminService({store,assets,owner,setupHash:process.env.SETUP_HASH});
export async function handler(event){
 if(!event.requestContext&&event.source==='frost.account-admin'){
  const {path,body={}}=event;const ok=data=>({statusCode:200,data}),bad=error=>({statusCode:400,data:{error}});
  if(path==='/announcement')return ok({message:(await store.get('announcement'))?.message||'',note:(await store.get('new-tab-note'))?.message||'',maintenance:await store.get('maintenance')||{enabled:false}});
  if(path==='/maintenance/publish'){let value;try{value=cleanMaintenance(body);}catch(error){return bad(error.message);}await store.put('maintenance',value);return ok({ok:true});}
  if(path==='/note/publish'){if(typeof body.note!=='string'||body.note.length>160)return bad('Use at most 160 characters.');await store.put('new-tab-note',{message:body.note.trim(),updatedAt:Date.now()});return ok({ok:true});}
  if(path==='/publish'){if(typeof body.message!=='string'||body.message.length>1000)return bad('Use at most 1,000 characters.');await store.put('announcement',{message:body.message.trim(),updatedAt:Date.now()});return ok({ok:true});}
  if(['/device/ban','/device/unban','/device/status'].includes(path)){
   if(!validDevice(body.device))return bad('Enter a valid device code.');const key='ban:'+body.device;
   if(path==='/device/ban'){if(typeof body.reason!=='string'||body.reason.length>200)return bad('Keep the private note under 200 characters.');await store.put(key,{reason:body.reason.trim(),updatedAt:Date.now()});}
   if(path==='/device/unban')await store.remove(key);const ban=await store.get(key);return ok({banned:!!ban,reason:ban?.reason||''});
  }
  return {statusCode:404,data:{error:'Unknown admin bridge operation.'}};
 }

 if(!event.requestContext&&event.source==='aws.events'&&event['detail-type']==='Scheduled Event')return owner('sample');
 return service(event);
}
