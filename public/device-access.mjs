let pending;
export function checkDevice() {
 if(pending)return pending;
 pending=(async()=>{
  const response=await fetch('/api/device',{cache:'no-store',signal:AbortSignal.timeout(6000)});
  const data=await response.json();
  const badge=document.getElementById('device-code');
  if(badge && data.device){badge.textContent='Device: '+data.device;badge.title='This browser’s device code. Share it with the Frost owner when needed.';}
  let blocked=document.getElementById('device-blocked');
  if(data.banned){
   if(!blocked){
    blocked=document.createElement('section');blocked.id='device-blocked';
    const title=document.createElement('h1');title.textContent='This browser is banned from Frost.';
    const message=document.createElement('p');message.textContent='Contact the Frost owner and include this device code:';
    const code=document.createElement('code');code.textContent=data.device;
    const retry=document.createElement('button');retry.textContent='Check again';retry.onclick=()=>void checkDevice().catch(()=>{});
    blocked.append(title,message,code,retry);document.body.append(blocked);
   }
   throw new Error('This browser is banned from Frost. Device: '+data.device);
  }
  if(!response.ok)throw new Error(data.error||'Device access check failed.');
  blocked?.remove();
  return data;
 })().finally(()=>{pending=undefined;});
 return pending;
}
