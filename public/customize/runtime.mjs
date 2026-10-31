import {renderDesign,refreshClocks} from './render.mjs';
import {SIZES} from './schema.mjs';

function placeNote(host,note,result,maxHeight){
 if(!note)return;
 const {stage,mode}=result,size=SIZES[mode];
 const mark=stage.querySelector('.design-required-brand');
 // Keep the brand at its authored position when adding room below it.
 mark.style.top=size.height/2+'px';
 note.classList.add('design-inline-note');
 note.style.top=(size.height/2+mark.offsetHeight/2+12)+'px';
 stage.append(note);
 let extra=0;
 if(!note.hidden){
  const lower=[...stage.querySelectorAll('.design-element')].filter(n=>parseFloat(n.style.top)>=size.height/2);
  const first=lower.length?Math.min(...lower.map(n=>parseFloat(n.style.top))):size.height;
  extra=Math.max(0,parseFloat(note.style.top)+note.offsetHeight+16-first);
  for(const n of lower)n.style.top=(parseFloat(n.style.top)+extra)+'px';
 }
 const height=size.height+extra,scale=Math.min(1,host.clientWidth/size.width,maxHeight/height);
 stage.style.height=height+'px';stage.style.transform='scale('+scale+')';
 const frame=host.querySelector('.design-frame');frame.style.width=size.width*scale+'px';frame.style.height=height*scale+'px';
}

export function mountPublishedDesign({landing,onSearch,onNavigate}){const host=document.createElement('div');const group=document.createElement('div');group.className='published-design-content';group.hidden=true;group.append(host);landing.insertBefore(group,landing.firstChild);const note=landing.querySelector('#new-tab-note'),originalParent=note?.parentElement;let design=null,dimensions='';function render(){try{if(!design){group.hidden=true;landing.classList.remove('has-design');if(note&&originalParent){note.classList.remove('design-inline-note');note.style.removeProperty('top');originalParent.insertBefore(note,originalParent.children[1]);}return;}group.hidden=false;landing.classList.add('has-design');if(note)group.append(note);const footer=landing.querySelector('.creator-footer');const outerHeight=node=>{if(!node||node.hidden)return 0;const style=getComputedStyle(node);return node.getBoundingClientRect().height+(parseFloat(style.marginTop)||0)+(parseFloat(style.marginBottom)||0);};const available=Math.max(360,landing.clientHeight-outerHeight(footer));const result=renderDesign(host,design,{onSearch,onNavigate,maxHeight:available});placeNote(host,note,result,available);}catch{design=null;group.hidden=true;landing.classList.remove('has-design');if(note&&originalParent){note.classList.remove('design-inline-note');note.style.removeProperty('top');originalParent.insertBefore(note,originalParent.children[1]);}}}async function load(){try{const r=await fetch('/api/account/design',{cache:'no-store'});if(!r.ok)return;const data=await r.json();design=data.design;render();}catch{}}const observer=new ResizeObserver(()=>{const next=[landing.clientWidth,landing.clientHeight,note?.getBoundingClientRect().height||0,landing.querySelector('.creator-footer')?.getBoundingClientRect().height||0].join('x');if(host.clientWidth&&dimensions!==next){dimensions=next;render();}});observer.observe(landing);if(note)observer.observe(note);const footer=landing.querySelector('.creator-footer');if(footer)observer.observe(footer);const resume=()=>{if(!document.hidden)void load();};document.addEventListener('visibilitychange',resume);const timer=setInterval(()=>refreshClocks(host),30000);void load();return ()=>{observer.disconnect();clearInterval(timer);document.removeEventListener('visibilitychange',resume);if(note&&originalParent){note.classList.remove('design-inline-note');note.style.removeProperty('top');originalParent.insertBefore(note,originalParent.children[1]);}group.remove();landing.classList.remove('has-design');};}
