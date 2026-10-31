export function mountServerHealth(menu){
 const section=document.createElement('div');section.className='menu-server-health';section.setAttribute('role','status');section.setAttribute('aria-live','polite');
 const heading=document.createElement('strong');heading.textContent='Fly servers';
 const details=document.createElement('div'),note=document.createElement('small');
 section.append(heading,details,note);menu.append(section);
 let pending=false;
 return async()=>{
  if(pending)return;pending=true;details.replaceChildren();note.textContent='Checking…';
  try{
   const response=await fetch('/api/server-health',{cache:'no-store',signal:AbortSignal.timeout(5000)});
   if(!response.ok)throw Error('Unavailable');const data=await response.json();
   if(!Array.isArray(data.servers)||data.servers.length!==2||!Number.isFinite(data.checkedAt))throw Error('Invalid check');
   for(const server of data.servers){
    const row=document.createElement('div'),name=document.createElement('span'),state=document.createElement('span');row.className='server-health-row';
    name.textContent=server.name;state.dataset.health=server.status;
    state.textContent=({healthy:'Healthy',unavailable:'Unavailable',unreachable:'Unreachable',unknown:'Unknown'})[server.status]||'Unknown';
    row.append(name,state);details.append(row);
   }
   note.textContent='HTTP check · '+new Date(data.checkedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }catch{details.replaceChildren();note.textContent='Couldn’t check servers. Reopen to retry.';}
  finally{pending=false;}
 };
}
