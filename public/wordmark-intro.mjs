// A quick thaw-and-settle entrance, confined to each new-tab wordmark.
export function createWordmarkIntro(element,{enabled=()=>true,motion=matchMedia('(prefers-reduced-motion: reduce)')}={}){
 const seen=new WeakSet();let animation;
 const cancel=()=>{animation?.cancel();animation=null;};
 motion.addEventListener?.('change',()=>{if(motion.matches)cancel();});
 return tab=>{
  cancel();
  if(!tab.home||tab.error||seen.has(tab))return;
  seen.add(tab);
  if(!enabled()||motion.matches||!element?.animate)return;
  animation=element.animate([
   {offset:0,opacity:.2,clipPath:'inset(85% 0 0 0)',transform:'translateY(9px) rotate(-2deg) scale(.96)'},
   {offset:.55,opacity:1,clipPath:'inset(0% 0 0 0)',transform:'translateY(-3px) rotate(.6deg) scale(1.015)'},
   {offset:.8,opacity:1,clipPath:'inset(0% 0 0 0)',transform:'translateY(1px) rotate(-.2deg) scale(.998)'},
   {offset:1,opacity:1,clipPath:'inset(0% 0 0 0)',transform:'translateY(0) rotate(0deg) scale(1)'}
  ],{duration:1300,easing:'cubic-bezier(.42,0,.25,1)',iterations:1});
 };
}
