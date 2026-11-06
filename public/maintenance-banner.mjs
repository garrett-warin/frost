export function maintenanceMessage(value,now=Date.now()) {
 if(!value?.enabled||typeof value.reason!=='string'||!value.reason.trim()||!Number.isSafeInteger(value.startsAt)||!Number.isSafeInteger(value.endsAt)||value.endsAt<=value.startsAt||now>=value.endsAt)return '';
 const date=n=>new Date(n).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
 const label=value.type==='disruption'?'Service disruption':'Maintenance';
 return (now<value.startsAt?'Scheduled '+label.toLowerCase()+': '+date(value.startsAt)+' – '+date(value.endsAt):label+' in progress · Expected to end '+date(value.endsAt))+'. '+value.reason.slice(0,300);
}
export function startMaintenance({banner,message,fetchStatus=fetch,now=Date.now,schedule=setTimeout,cancel=clearTimeout,doc=document}){
 let timer,stopped=false,value=null;
 const render=()=>{const text=maintenanceMessage(value,now());message.textContent=text;banner.hidden=!text;if(banner.dataset)banner.dataset.noticeType=value?.type==='disruption'?'disruption':'maintenance';};
 async function check(){try{const res=await fetchStatus('/api/announcement',{cache:'no-store',signal:AbortSignal.timeout(5000)});if(res.ok)value=(await res.json()).maintenance;}catch{}finally{if(!stopped){render();timer=schedule(check,15000);}}}
 void check();return ()=>{stopped=true;cancel(timer);};
}
if(typeof document!=='undefined'){const banner=document.getElementById('maintenance-banner'),message=document.getElementById('maintenance-message');if(banner&&message)startMaintenance({banner,message});}
