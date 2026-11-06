import {readResponses} from './verification-responses.mjs';
                                                                          
                                                                           
export async function dispatchOwner(event,service,analytics){
 if(event.requestContext||event.source!=='frost.admin')return null;
 try{
  const {action,body={}}=event;
  let data;
  if(['templates-detail','templates-list','templates-reports','templates-remove'].includes(action))return {statusCode:410,data:{error:'New-tab customization has been removed.'}};
  else if(action==='verification-responses')data=await readResponses(service.accounts);
  else if(action==='sample'){data=await analytics.sample();await service.control.rebalance();}
  else if(action==='dashboard')data=await analytics.dashboard(body.range,body.timezone);
  else if(action==='browsing-history')data=await service.browsingHistory.read(body);
  else if(action==='accounts')data=await analytics.listUsers(body);
  else if(['notify','user','list','ticket','ticket-create','links','link','assign','refresh'].includes(action))data=await service.control.admin(action,body);
  else return {statusCode:400,data:{error:'Unknown owner operation.'}};
  return {statusCode:200,data};
 }catch(error){return {statusCode:error.status||503,data:{error:error.status?error.message:'Account controls unavailable.'}};}
}
