import {LambdaClient,InvokeCommand} from '@aws-sdk/client-lambda';
import {dynamoStore} from './store.mjs';
import {platformConfig} from './config.mjs';
import {createPlatformService} from './http.mjs';
import {createMonitor} from './monitor.mjs';
import {createAnalytics} from './analytics.mjs';
import {dispatchOwner} from './owner.mjs';
import {assets} from './assets.mjs';
const adminLambda=new LambdaClient({});
async function legacyAdmin(path,body){if(!process.env.FROST_ADMIN_FUNCTION)return {statusCode:503,data:{error:'Admin bridge is not configured.'}};const result=await adminLambda.send(new InvokeCommand({FunctionName:process.env.FROST_ADMIN_FUNCTION,Payload:Buffer.from(JSON.stringify({source:'frost.account-admin',path,body}))}));if(result.FunctionError)throw Error('Admin bridge failed');return JSON.parse(Buffer.from(result.Payload).toString());}
let initialized,initializedAt=0;
async function initialize(){
 const store=dynamoStore(process.env.FROST_PLATFORM_TABLE),settings=await store.get('deployment-config');
 if(!settings)throw Error('Account service configuration is pending.');
 const config=platformConfig(process.env,settings),service=createPlatformService({store,config,assets,legacyAdmin});
 return {...service,analytics:createAnalytics(service.accounts),monitor:createMonitor(service.accounts,service.control)};
}
export async function handler(event){
 try{
  if(Date.now()-initializedAt>30000){initialized=undefined;initializedAt=Date.now();}
  initialized??=initialize().catch(error=>{initialized=undefined;throw error;});const service=await initialized;
  const owner=await dispatchOwner(event,service,service.analytics);if(owner)return owner;
  if(event.source==='aws.events'&&event['detail-type']==='Scheduled Event')return service.monitor.tick();
  return service.handler(event);
 }catch{return {statusCode:503,headers:{'content-type':'application/json','cache-control':'no-store'},body:JSON.stringify({error:'Account service setup is incomplete. Please try again later.'})};}
}
