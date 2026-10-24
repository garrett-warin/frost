import {snowman,companionMotion} from './companion.mjs';
import {renderMarkdown} from './markdown.js';
import {checkDevice} from '../device-access.mjs';
import {createFrostyRoute} from './route.mjs';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
export function mountFrosty({getPage,openLink,onOpen}){
 const root=el('main','frosty');root.hidden=true;root.setAttribute('aria-label','Frosty assistant');
 const launcher=document.getElementById('frosty-open');const mascot=el('div','frosty-mascot');mascot.innerHTML=snowman();
 const panel=el('section','frosty-panel');panel.id='frosty-panel';panel.setAttribute('aria-label','Chat with Frosty');launcher.setAttribute('aria-controls',panel.id);
 const head=el('header','frosty-head');const identity=el('div');identity.append(el('h1','','frosty'));
 const close=el('button','frosty-close','← back to frost');close.setAttribute('aria-label','Back to Frost');const name=identity.querySelector('h1');const wordmark=el('img');wordmark.src='/frosty/wordmark.svg';wordmark.alt='frosty';name.replaceChildren(wordmark);head.append(close,identity);
 const modelRow=el('div','frosty-model-row');const label=el('label','','Model');label.htmlFor='frosty-model';const model=el('select');model.id='frosty-model';model.append(new Option('Loading models…',''));model.disabled=true;
 const clear=el('button','','New chat');modelRow.append(label,model,clear);
 const log=el('div','frosty-messages');log.setAttribute('role','log');log.setAttribute('aria-label','Conversation');log.setAttribute('aria-live','off');
 const welcome=el('div','frosty-welcome');welcome.append(mascot,el('h2','','what’s on your mind?'),el('p','','Ask a question, or attach a page to talk about it.'));log.append(welcome);
 const notice=el('p','frosty-notice','Checking connection…');notice.setAttribute('role','status');
 const activity=el('details','frosty-activity'),summary=el('summary','','Activity'),timeline=el('ol');activity.append(summary,timeline);activity.hidden=true;
 const contextBox=el('div','frosty-context');contextBox.hidden=true;const contextLabel=el('span'),removeContext=el('button','','Remove');contextBox.append(contextLabel,removeContext);
 const actions=el('div','frosty-context-actions');const page=el('button','','Attach page'),selection=el('button','','Attach selection');const upload=el('button','','Attach image'),fileInput=el('input');fileInput.type='file';fileInput.accept='image/png,image/jpeg,image/webp';fileInput.hidden=true;fileInput.setAttribute('aria-label','Choose an image');actions.append(page,selection,upload,fileInput);
 const imageBox=el('div','frosty-image-attachment');imageBox.hidden=true;const imagePreview=el('img'),imageLabel=el('span'),removeImage=el('button','','Remove image');imagePreview.alt='Image attached to your next message';imageBox.append(imagePreview,imageLabel,removeImage);
 const form=el('form','frosty-composer');const input=el('textarea');input.rows=2;input.maxLength=6000;input.placeholder='Ask Frosty anything…';input.setAttribute('aria-label','Message Frosty');
 const bottom=el('div','frosty-compose-bottom'),hint=el('small','','Enter to send · Shift+Enter for a new line'),send=el('button','frosty-send','Send');send.type='submit';const stop=el('button','frosty-stop','Stop');stop.type='button';stop.hidden=true;bottom.append(hint,stop,send);form.append(input,bottom);
 const privacy=el('p','frosty-privacy','Messages go to the configured AI provider. Page text is shared only when attached. Chats stay in this tab until cleared.');
 const compose=el('div','frosty-compose-area');compose.append(notice,activity,contextBox,imageBox,actions,form,privacy);panel.append(head,modelRow,log,compose);root.append(panel);document.body.append(root);
 const motion=companionMotion(mascot);let opened=false,config,controller,context=null,messages=[],lastRequest=null,imageAttachment=null,imageReading=false,imageVersion=0;
 try{const stored=JSON.parse(sessionStorage.getItem('frosty.chat')||'[]');if(Array.isArray(stored))messages=stored.filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string'&&m.content.length<=24000).slice(-24);}catch{}
 const save=()=>{try{sessionStorage.setItem('frosty.chat',JSON.stringify(messages.slice(-24).map(({role,content,imageAttached})=>({role,content,...(imageAttached?{imageAttached:true}:{})}))));}catch{}};
 function placeMascot(){const latest=log.querySelectorAll('article.assistant');const reply=latest[latest.length-1];(reply||welcome).prepend(mascot);welcome.hidden=!!reply;}
 function addMessage(message,attachedImage=null){root.classList.add('has-messages');const article=el('article','frosty-message '+message.role);article.append(el('small','frosty-author',message.role==='user'?'YOU':'FROSTY'));const content=el('div','frosty-prose');if(message.role==='user')content.textContent=message.content;else renderMarkdown(content,message.content);article.append(content);if(message.imageAttached){if(attachedImage){const picture=el('img','frosty-sent-image');picture.src='data:'+attachedImage.mimeType+';base64,'+attachedImage.data;picture.alt='Image sent with this message';article.append(picture);}article.append(el('small','frosty-image-caption','Image sent with this message · reattach it for follow-up questions.'));}log.append(article);placeMascot();return {article,content};}
 function completed(view,message){const copy=el('button','frosty-copy','Copy');copy.onclick=async()=>{try{await navigator.clipboard.writeText(message.content);copy.textContent='Copied';motion.set('success');setTimeout(()=>{copy.textContent='Copy';if(!controller)motion.set('listening');},1500);}catch{notice.textContent='Copy unavailable. Select the answer to copy it.';}};view.article.append(copy);}
 for(const message of messages){const view=addMessage(message);if(message.role==='assistant')completed(view,message);}
 const atBottom=()=>log.scrollHeight-log.scrollTop-log.clientHeight<70;
 const follow=near=>{if(near)log.scrollTop=log.scrollHeight;};
 function state(value,text){motion.set(value);notice.textContent=text;}
 function record(text){activity.hidden=false;const item=el('li','',text);timeline.append(item);summary.textContent=text;}
 const route=createFrostyRoute({render(value){
  const changed=opened!==value;opened=value;root.hidden=!value;document.body.classList.toggle('frosty-open',value);motion.visible(value);
  launcher.setAttribute('aria-current',value?'page':'false');
  if(changed&&value){onOpen?.();motion.set('opening');input.focus();log.scrollTop=log.scrollHeight;}
  else if(changed){motion.set('idle');launcher.focus();}
 }});
 launcher.onclick=()=>route.open();close.onclick=()=>route.close();
 root.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();route.close();}});
 log.addEventListener('click',e=>{const link=e.target.closest('a[href]');if(link){e.preventDefault();route.close();openLink(link.href);}});
 async function attach(kind){try{state('reading','Reading the selected page text…');const snapshot=getPage(kind);if(!snapshot?.text)throw Error(kind==='selection'?'Select some webpage text first.':'Open a readable webpage first.');context={title:snapshot.title.slice(0,300),text:snapshot.text.slice(0,16000)};contextLabel.textContent=(kind==='selection'?'Selection: ':'Page: ')+context.title;contextBox.hidden=false;record('Attached '+(kind==='selection'?'selected text':'page text')+' · '+context.text.length.toLocaleString()+' characters');state('listening','Snapshot attached. It will be sent with your next message.');}catch(e){state('error',e.message);}}
 page.onclick=()=>attach('page');selection.onclick=()=>attach('selection');removeContext.onclick=()=>{context=null;contextBox.hidden=true;};

 function forgetImage(){imageVersion++;imageAttachment=null;imageReading=false;imageBox.hidden=true;imagePreview.removeAttribute('src');imageLabel.textContent='';fileInput.value='';}
 function supportsImage(){return !!config?.models.find(item=>item.id===model.value)?.supportsImages;}
 function rememberModel(){try{localStorage.setItem('frosty.model',model.value);}catch{}}
 upload.onclick=()=>fileInput.click();
 removeImage.onclick=()=>{forgetImage();busy(!!controller);notice.textContent=config?.ready?'Ready when you are.':config?.message||'Not connected.';};
 fileInput.onchange=async()=>{
  const file=fileInput.files?.[0];if(!file)return;
  const version=++imageVersion;imageReading=true;busy(!!controller);
  try{
   if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Choose a PNG, JPEG, or WebP image.');
   if(!file.size||file.size>2*1024*1024)throw Error('Choose an image no larger than 2 MB.');
   const available=config?.models.find(item=>item.supportsImages);if(!available)throw Error('No image-capable model is configured yet.');
   const bytes=new Uint8Array(await file.arrayBuffer());if(version!==imageVersion)return;
   let binary='';for(let offset=0;offset<bytes.length;offset+=32768)binary+=String.fromCharCode(...bytes.subarray(offset,offset+32768));
   imageAttachment={mimeType:file.type,data:btoa(binary)};imagePreview.src='data:'+file.type+';base64,'+imageAttachment.data;imageLabel.textContent=file.name+' · '+Math.ceil(file.size/1024)+' KB';imageBox.hidden=false;
   let switched=false;if(!supportsImage()){model.value=available.id;rememberModel();switched=true;}
   notice.textContent=(switched?'Switched to '+model.selectedOptions[0].textContent+'. ':'')+'Image attached. It is shared only when you send.';
  }catch(error){if(version===imageVersion)notice.textContent=error.message;}
  finally{if(version===imageVersion){imageReading=false;fileInput.value='';busy(!!controller);}}
 };
 clear.onclick=()=>{controller?.abort();messages=[];save();for(const article of log.querySelectorAll('article'))article.remove();root.classList.remove('has-messages');placeMascot();timeline.replaceChildren();activity.hidden=true;context=null;contextBox.hidden=true;lastRequest=null;forgetImage();root.querySelectorAll('.frosty-retry').forEach(n=>n.remove());state('listening',config?.ready?'Ready when you are.':config?.message||'Not connected.');busy(false);};
 model.onchange=()=>{rememberModel();if(imageAttachment)notice.textContent=supportsImage()?'Image attached. It is shared only when you send.':'Choose an image-capable model to send this image.';busy(!!controller);};
 stop.onclick=()=>controller?.abort();
 function busy(value){send.disabled=value||imageReading||!config?.ready||!!imageAttachment&&!supportsImage();stop.hidden=!value;model.disabled=value||imageReading||!config?.models.length;page.disabled=selection.disabled=value;upload.disabled=value||imageReading||!config?.models.some(item=>item.supportsImages);removeImage.disabled=value;clear.disabled=value;}
 async function request(payload){
  if(payload.image&&!supportsImage()){notice.textContent='Choose an image-capable model to retry this image.';return;}
  controller=new AbortController();const own=controller;busy(true);lastRequest=payload;
  const reply={role:'assistant',content:''},view=addMessage(reply);let finished=false,streamStarted=false;
  state('thinking','Connecting to '+model.selectedOptions[0].textContent+'…');record('Request sent · '+model.selectedOptions[0].textContent);
  try{
   await checkDevice();if(own.signal.aborted)throw new DOMException('Stopped','AbortError');
   const response=await fetch('/api/frosty/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:own.signal});
   if(!response.ok){const data=await response.json();throw Error(data.error||'Frosty could not answer.');}
   const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
   while(true){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let n;while((n=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,n);buffer=buffer.slice(n+1);if(!line)continue;const event=JSON.parse(line);if(event.type==='error')throw Error(event.message);if(event.type==='activity')record(event.label);if(event.type==='delta'){if(!streamStarted){streamStarted=true;state('responding','Writing your answer…');record('Response streaming');}const near=atBottom();reply.content+=event.text;view.content.textContent=reply.content;follow(near);}if(event.type==='done')finished=true;}}
   if(!finished)throw Error('The connection ended before the answer finished.');
   renderMarkdown(view.content,reply.content);messages.push(reply);save();completed(view,reply);record('Response complete');state('success','All set. What’s next?');setTimeout(()=>{if(!controller)motion.set(opened?'listening':'idle');},1400);
  }catch(e){
   const stopped=e.name==='AbortError';state(stopped?'listening':'error',stopped?'Stopped. You can retry when you’re ready.':e.message);record(stopped?'Stopped by you':'Request failed');
   if(reply.content){renderMarkdown(view.content,reply.content);view.article.append(el('small','','Partial response · not added to conversation'));}
   else {view.article.remove();placeMascot();}
   const retry=el('button','frosty-retry','Retry last message');retry.onclick=()=>{if(controller)return;if(lastRequest?.image&&!supportsImage()){notice.textContent='Choose an image-capable model to retry this image.';return;}retry.remove();void request({...lastRequest,model:model.value});};notice.after(retry);
  }finally{if(controller===own){controller=null;busy(false);}}
 }
 form.onsubmit=e=>{e.preventDefault();const text=input.value.trim()||(imageAttachment?'Describe this image.':'');if(!text||controller||imageReading||!config?.ready)return;if(imageAttachment&&!supportsImage()){notice.textContent='Choose an image-capable model to send this image.';return;}root.querySelectorAll('.frosty-retry').forEach(n=>n.remove());if(messages.length>=22){notice.textContent='Start a new chat to continue.';return;}const attachedImage=imageAttachment;const msg={role:'user',content:text,...(attachedImage?{imageAttached:true}:{})};messages.push(msg);addMessage(msg,attachedImage);save();input.value='';follow(true);const payload={model:model.value,messages:messages.map(({role,content})=>({role,content})),...(context?{context}:{}),...(attachedImage?{image:attachedImage}:{})};context=null;contextBox.hidden=true;forgetImage();void request(payload);};
 input.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();form.requestSubmit();}};
 fetch('/api/frosty/config',{cache:'no-store'}).then(r=>r.json()).then(data=>{config=data;model.replaceChildren();for(const item of data.models)model.append(new Option(item.name+(item.supportsImages?' [images]':''),item.id));if(!data.models.length)model.append(new Option('No models configured',''));try{const preferred=localStorage.getItem('frosty.model');if(data.models.some(m=>m.id===preferred))model.value=preferred;}catch{}notice.textContent=data.ready?'Ready when you are.':data.message;privacy.textContent=`Messages and attachments go to ${data.provider} when sent. Images are not saved in chat history; reattach them for follow-ups.`;busy(false);}).catch(()=>{notice.textContent='Could not load Frosty. Reload to retry.';send.disabled=true;});
 busy(false);
 queueMicrotask(()=>route.sync());
 return route;
}
