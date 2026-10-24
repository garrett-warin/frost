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
export const handler=createAdminService({store,assets,setupHash:process.env.SETUP_HASH});
