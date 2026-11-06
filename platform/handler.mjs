import {createSupportAIProvider} from './support-ai-provider.mjs';
import {createSupportAutomation} from './support-automation.mjs';
import {LambdaClient,InvokeCommand} from '@aws-sdk/client-lambda';
import {dynamoStore} from './store.mjs';
import {platformConfig,settingsForAccountHost} from './config.mjs';
import {createPlatformService} from './http.mjs';
import {createMonitor} from './monitor.mjs';
import {createAnalytics} from './analytics.mjs';
import {dispatchOwner} from './owner.mjs';
import {assets} from './assets.mjs';
const adminLambda=new LambdaClient({});
async function legacyAdmin(path,body){if(!process.env.FROST_ADMIN_FUNCTION)return {statusCode:503,data:{error:'Admin bridge is not configured.'}};const result=await adminLambda.send(new InvokeCommand({FunctionName:process.env.FROST_ADMIN_FUNCTION,Payload:Buffer.from(JSON.stringify({source:'frost.account-admin',path,body}))}));if(result.FunctionError)throw Error('Admin bridge failed');return JSON.parse(Buffer.from(result.Payload).toString());}
let initialized,initializedAt=0;
let initializedHost=null;
async function initialize(host){
 const store=dynamoStore(process.env.FROST_PLATFORM_TABLE),settings=await store.get('deployment-config');
 if(!settings)throw Error('Account service configuration is pending.');
 const config=platformConfig(process.env,settingsForAccountHost(settings,host));
 const terms=assets['/terms.html'].body.replace(/<nav[\s\S]*?<\/nav>/g,'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
 const provider=createSupportAIProvider({terms});config.supportAI=!!provider;
 const service=createPlatformService({store,config,assets,legacyAdmin});service.supportAI=createSupportAutomation(service.accounts,provider);
 return {...service,analytics:createAnalytics(service.accounts),monitor:createMonitor(service.accounts,service.control)};
}
export async function handler(event){
 try{
  const host=event.requestContext?.http?event.headers?.host||event.headers?.Host||'':'';
  if(Date.now()-initializedAt>30000||initializedHost!==host){initialized=undefined;initializedAt=Date.now();initializedHost=host;}
  const pending=initialized??=initialize(host);
  let service;try{service=await pending;}catch(error){if(initialized===pending)initialized=undefined;throw error;}
  if(!event.requestContext&&event.source==='frost.support-ai')return service.supportAI.tick();
  const owner=await dispatchOwner(event,service,service.analytics);if(owner)return owner;
  if(event.source==='aws.events'&&event['detail-type']==='Scheduled Event')return service.monitor.tick();
  return service.handler(event);
 }catch{return {statusCode:503,headers:{'content-type':'application/json','cache-control':'no-store'},body:JSON.stringify({error:'Account service setup is incomplete. Please try again later.'})};}
}
