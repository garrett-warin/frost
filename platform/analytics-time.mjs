import {requireThat} from './security.mjs';
const day=86400;
export function analyticsDays(at,timezone='UTC'){
 requireThat(typeof timezone==='string'&&timezone.length<=100,400,'Invalid timezone.');
 let format;
 try{format=new Intl.DateTimeFormat('en-US',{timeZone:timezone,year:'numeric',month:'numeric',day:'numeric'});}catch{requireThat(false,400,'Invalid timezone.');}
 const dateKey=seconds=>{
  const parts=Object.fromEntries(format.formatToParts(new Date(seconds*1000)).map(p=>[p.type,p.value]));
  return Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day))/1000;
 };
 const today=dateKey(at),starts=[];
                                                                                
 for(let offset=-6;offset<=1;offset++){
  const target=today+offset*day;let low=target-2*day,high=target+2*day;
  while(low<high){const mid=Math.floor((low+high)/2);if(dateKey(mid)<target)low=mid+1;else high=mid;}
  starts.push(low);
 }
 return {timezone:format.resolvedOptions().timeZone,starts};
}
