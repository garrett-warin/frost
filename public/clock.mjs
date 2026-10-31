const clock=document.getElementById('new-tab-clock');
function update(){
 if(!clock)return;
 const now=new Date();
 clock.dateTime=now.toISOString();
 clock.textContent=now.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
 clock.title=now.toLocaleString(undefined,{timeZoneName:'long'});
}
update();
setInterval(()=>{if(!document.hidden)update();},1000);
document.addEventListener('visibilitychange',update);
