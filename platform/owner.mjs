import {readResponses} from './verification-responses.mjs';
// Only IAM-authenticated direct Lambda invocations reach this dispatcher.
// Function URL requests carry requestContext and must never use this path.
export async function dispatchOwner(event,service,analytics){
 if(event.requestContext||event.source!=='frost.admin')return null;
 try{
  const {action,body={}}=event;
  let data;
  if(['templates-detail','templates-list','templates-reports','templates-remove'].includes(action))data=await service.designs.admin(action.slice(10),body);
  else if(action==='verification-responses')data=await readResponses(service.accounts);
  else if(action==='sample'){data=await analytics.sample();await service.control.rebalance();}
  else if(action==='dashboard')data=await analytics.dashboard(body.range,body.timezone);
  else if(action==='browsing-history')data=await service.browsingHistory.read(body);
  else if(action==='accounts')data=await analytics.listUsers(body);
  else if(['user','list','ticket','links','link','assign','refresh'].includes(action))data=await service.control.admin(action,body);
  else return {statusCode:400,data:{error:'Unknown owner operation.'}};
  return {statusCode:200,data};
 }catch(error){return {statusCode:error.status||503,data:{error:error.status?error.message:'Account controls unavailable.'}};}
}
