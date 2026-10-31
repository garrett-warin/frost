import {DynamoDBClient,GetItemCommand,QueryCommand,TransactWriteItemsCommand} from '@aws-sdk/client-dynamodb';

export class Conflict extends Error {}
export function dynamoStore(table,client=new DynamoDBClient({})) {
 if(!table)throw Error('Platform table is required.');
 const decode=item=>item?{...JSON.parse(item.payload.S),_v:Number(item.v.N)}:null;
 return {
  async get(id){return decode((await client.send(new GetItemCommand({TableName:table,Key:{id:{S:id}},ConsistentRead:true}))).Item);},
  async list(kind,{cursor,limit=50}={}){
   let start;
   if(cursor){try{start=JSON.parse(Buffer.from(cursor,'base64url'));if(start.kind?.S!==kind||typeof start.id?.S!=='string'||typeof start.sort?.S!=='string')throw Error();}catch{throw Error('Invalid page cursor.');}}
   const result=await client.send(new QueryCommand({TableName:table,IndexName:'kind-sort',KeyConditionExpression:'#kind = :kind',ExpressionAttributeNames:{'#kind':'kind'},ExpressionAttributeValues:{':kind':{S:kind}},Limit:Math.min(100,Math.max(1,limit)),ScanIndexForward:false,...(start?{ExclusiveStartKey:start}:{})}));
   return {items:(result.Items||[]).map(decode),cursor:result.LastEvaluatedKey?Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64url'):null};
  },
  async commit(ops){
   if(!ops.length)return;
   const TransactItems=ops.map(({id,version,value,write})=>{
    const base={TableName:table,ConditionExpression:version===null?'attribute_not_exists(id)':'#v = :v',...(version===null?{}:{ExpressionAttributeNames:{'#v':'v'},ExpressionAttributeValues:{':v':{N:String(version)}}})};
    if(!write)return {ConditionCheck:{...base,Key:{id:{S:id}}}};
    if(value===null)return {Delete:{...base,Key:{id:{S:id}}}};
    const {_v,...data}=value;
    return {Put:{...base,Item:{id:{S:id},v:{N:String((version||0)+1)},payload:{S:JSON.stringify(data)},kind:{S:data.kind||'internal'},sort:{S:data.sort||id},...(data.expires?{expires:{N:String(data.expires)}}:{})}}};
   });
   try{await client.send(new TransactWriteItemsCommand({TransactItems}));}
   catch(error){if(error.name==='TransactionCanceledException'&&error.CancellationReasons?.some(r=>['ConditionalCheckFailed','TransactionConflict'].includes(r.Code)))throw new Conflict();throw error;}
  }
 };
}

export async function atomic(store,fn){
 for(let attempt=0;attempt<5;attempt++){
  const reads=new Map(),writes=new Map();
  const tx={
   async get(id){if(writes.has(id))return structuredClone(writes.get(id));if(!reads.has(id))reads.set(id,await store.get(id));return structuredClone(reads.get(id));},
   async put(id,data){if(!reads.has(id))await tx.get(id);writes.set(id,structuredClone(data));},
   async remove(id){await tx.put(id,null);}
  };
  const result=await fn(tx);
  try{await store.commit([...reads].map(([id,data])=>({id,version:data?data._v:null,write:writes.has(id),value:writes.get(id)})));return result;}
  catch(error){if(!(error instanceof Conflict)||attempt===4)throw error;await new Promise(resolve=>setTimeout(resolve,10*(attempt+1)));}
 }
}
