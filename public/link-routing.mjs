export function resolveLink(value, base, proxyOrigin, prefix) {
 try {
  let url=new URL(String(value),base);
  if(url.origin===proxyOrigin && url.pathname.startsWith(prefix)) url=new URL(decodeURIComponent(url.pathname.slice(prefix.length))+url.search+url.hash);
  return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password ? url.href : null;
 } catch {return null;}
}
export function installLinkRouting(win,{base,proxyOrigin,prefix,open}) {
 const doc=win.document;
 const resolve=value=>resolveLink(value,doc.baseURI || base(),proxyOrigin,prefix);
 const originalOpen=win.open?.bind(win);
 const handler=event=>{
  if(event.defaultPrevented || (event.type==='click'?event.button!==0:event.button!==1))return;
  const link=event.composedPath().find(node=>node?.matches?.('a[href],area[href]'));
  if(!link || link.hasAttribute('download'))return;
  const target=(link.getAttribute('target') || doc.querySelector('base[target]')?.getAttribute('target') || '_self').toLowerCase();
  const extra=event.button===1||event.ctrlKey||event.metaKey||event.shiftKey||!['_self','_top','_parent',''].includes(target);
  if(!extra)return;
  const url=resolve(link.href);
  if(!url)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(extra && !event.isTrusted && !win.navigator?.userActivation?.isActive)return;
  open(url,{newTab:extra,background:(event.button===1||event.ctrlKey||event.metaKey)&&!event.shiftKey});
 };
 doc.addEventListener('click',handler,true);
 doc.addEventListener('auxclick',handler,true);
 // Keep form submissions in the browsing frame, preserving POST bodies.
 doc.addEventListener('submit',event=>{
  const form=event.target;
  if(form?.tagName!=='FORM')return;
  form.target='_self';
  if(event.submitter)event.submitter.formTarget='_self';
 },true);
 const formPrototype=win.HTMLFormElement?.prototype;
 if(formPrototype?.submit){
  const submit=formPrototype.submit;
  formPrototype.submit=function(){this.target='_self';return Reflect.apply(submit,this,arguments);};
 }
 win.open=function(value='',target='_blank',features) {
  if(['_self','_top','_parent'].includes(String(target).toLowerCase()))return originalOpen?.(value,target,features) ?? null;
  if(!value || value==='about:blank')return null;
  const url=resolve(value); if(!url)return null;
  if(!win.navigator?.userActivation?.isActive)return null;
  open(url,{newTab:!['_self','_top','_parent'].includes(String(target).toLowerCase()),background:false});
  // No native popup or fabricated WindowProxy is exposed to the website.
  return null;
 };
}
export function routingPlugin(ManagedPlugin,open,proxyOrigin) {
 return new class extends ManagedPlugin {
  constructor(){super('frost-tabs',[]);}
  install(frame){super.install(frame);this.tap(frame.hooks.init.post,({window:win,client})=>{
   installLinkRouting(win,{base:()=>client.url.href,proxyOrigin,prefix:frame.prefix,open});
  });}
 }();
}
