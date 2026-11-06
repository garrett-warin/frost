                                                                       
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
   {offset:0,opacity:0,clipPath:'inset(100% 0 0 0)',transformOrigin:'50% 85%',transform:'translateY(12px) scale(.96,.72) rotate(-1.6deg)'},
   {offset:.42,opacity:1,clipPath:'inset(24% 0 0 0)',transformOrigin:'50% 85%',transform:'translateY(2px) scale(.99,.96) rotate(-1deg)'},
   {offset:.65,opacity:1,clipPath:'inset(0% 0 0 0)',transformOrigin:'50% 85%',transform:'translateY(0) scale(1,1.025) rotate(1.4deg)'},
   {offset:.84,opacity:1,clipPath:'inset(0% 0 0 0)',transformOrigin:'50% 85%',transform:'translateY(0) scale(1,1) rotate(-.65deg)'},
   {offset:1,opacity:1,clipPath:'inset(0% 0 0 0)',transformOrigin:'50% 85%',transform:'translateY(0) scale(1) rotate(0deg)'}
  ],{duration:2100,easing:'cubic-bezier(.42,0,.25,1)',iterations:1});
 };
}
