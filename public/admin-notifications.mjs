                                                                                     
let queue=[],current=null,region=null,generation=0;
const dismissed=new Set();
function element(tag,text,className){const value=document.createElement(tag);if(text!==undefined)value.textContent=text;if(className)value.className=className;return value;}
function reducedMotion(){
 if(document.body.dataset.animations==='false'||document.body.dataset.reducedMotion==='true')return true;
 try{const settings=JSON.parse(localStorage.getItem('frost.preferences.v1')||'{}');if(settings.animations===false||settings.reducedMotion===true)return true;}catch{}
 return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
}
function bell(){
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),path=document.createElementNS(ns,'path');
 svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.classList.add('grove-notification-bell');
 path.setAttribute('d','M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4');svg.append(path);return svg;
}
function displayNext(){
 if(current||!queue.length)return;
 if(!document.getElementById('grove-admin-notification-style')){const css=element('link');css.id='grove-admin-notification-style';css.rel='stylesheet';css.href='/admin-notifications.css';document.head.append(css);}
 current=queue.shift();const item=current,epoch=generation;
 region=element('section',undefined,'grove-admin-notification');region.setAttribute('role','status');region.setAttribute('aria-live','polite');region.setAttribute('aria-atomic','true');region.dataset.reducedMotion=String(reducedMotion());
 const content=element('div',undefined,'grove-notification-content'),heading=element('strong','Administrator'),message=element('p',item.message),feedback=element('small',undefined,'grove-notification-feedback');feedback.hidden=true;
 const close=element('button','×','grove-notification-dismiss');close.type='button';close.setAttribute('aria-label','Dismiss administrator notification');close.title='Dismiss';
 content.append(heading,message,feedback);region.append(bell(),content,close);document.body.append(region);
 close.addEventListener('click',async()=>{
  if(close.disabled)return;close.disabled=true;feedback.hidden=true;
  try{
   const result=await item.ack(item.id);if(result===false)throw Error('Acknowledgement failed');
   if(generation!==epoch||current!==item)return;
   dismissed.add(item.id);if(dismissed.size>100)dismissed.delete(dismissed.values().next().value);
   region?.remove();region=null;current=null;displayNext();
  }catch{
   if(generation!==epoch||current!==item)return;
   feedback.textContent='Could not dismiss. Try again.';feedback.hidden=false;close.disabled=false;close.textContent='Retry';close.setAttribute('aria-label','Retry dismissing administrator notification');
  }
 });
}
export function showAdminNotifications(items,ack){
 if(!Array.isArray(items)||typeof ack!=='function')return;
 for(const item of items.slice(0,5)){
  if(queue.length+(current?1:0)>=5)break;
  if(!item||typeof item.id!=='string'||!item.id||item.id.length>160||typeof item.message!=='string'||!item.message.trim()||item.message.length>500)continue;
  if(dismissed.has(item.id)||current?.id===item.id||queue.some(queued=>queued.id===item.id))continue;
  queue.push({id:item.id,message:item.message,ack});
 }
 displayNext();
}
export function clearAdminNotifications(){
 generation++;queue=[];current=null;region?.remove();region=null;dismissed.clear();
}
