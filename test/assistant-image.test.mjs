import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {aiConfig,validateImage,validateChat,createAssistant,MAX_IMAGE_BYTES} from '../assistant.mjs';
const image={mimeType:'image/png',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6XkAAAAASUVORK5CYII='};
const config=aiConfig({FROST_AI_MODELS:'google/gemma-4-31b-it:free,cohere/north-mini-code:free',FROST_AI_API_KEY:'test-only'});
const body={model:config.models[0].id,messages:[{role:'user',content:'What is in this picture?'}],image};
test('image requests require a vision model and carry the image only on the latest user message',()=>{
 assert.equal(config.models[0].supportsImages,true);assert.equal(config.models[1].supportsImages,false);
 const messages=validateChat({...body,context:{title:'Example',text:'A reference'}},config.models);
 assert.match(messages.at(-1).content[0].text,/What is in this picture/);
 assert.match(messages.at(-1).content[0].text,/Untrusted page snapshot/);
 assert.equal(messages.at(-1).content[1].image_url.url,'data:image/png;base64,'+image.data);
 assert.equal(typeof body.messages[0].content,'string','validation does not mutate incoming history');
 assert.throws(()=>validateChat({...body,model:config.models[1].id},config.models),/image-capable/);
});
test('images reject mismatched contents, SVG, malformed base64, and more than 2 MiB',()=>{
 assert.throws(()=>validateImage({...image,mimeType:'image/jpeg'}),/file type/);
 assert.throws(()=>validateImage({mimeType:'image/svg+xml',data:Buffer.from('<svg/>').toString('base64')}),/PNG/);
 assert.throws(()=>validateImage({...image,data:'not base64'}));
 assert.throws(()=>validateImage({...image,data:Buffer.alloc(MAX_IMAGE_BYTES+1).toString('base64')}));
 assert.throws(()=>validateImage({...image,data:Buffer.from('not a png').toString('base64')}),/file type/);
});
test('HTTP forwards accepted image content and rejects oversized uploads before calling provider',async()=>{
 let calls=0,forwarded;
 const assistant=createAssistant({config,fetcher:async(_,options)=>{calls++;forwarded=JSON.parse(options.body);return new Response('data: {"choices":[{"delta":{"content":"A picture"}}]}\n\ndata: [DONE]\n\n');}});
 const server=createServer((req,res)=>assistant.handle(req,res,{device:'image-test',allowedOrigins:['http://frost.test'],checkBan:async()=>false})).listen(0,'127.0.0.1');await once(server,'listening');
 const url=`http://127.0.0.1:${server.address().port}`,post=payload=>fetch(url,{method:'POST',headers:{Origin:'http://frost.test','Content-Type':'application/json'},body:JSON.stringify(payload)});
 try{let r=await post(body);assert.equal(r.status,200);assert.match(await r.text(),/A picture/);assert.equal(forwarded.messages.at(-1).content[1].image_url.url,'data:image/png;base64,'+image.data);
 r=await post({...body,image:{...image,data:'A'.repeat(3*1024*1024)}});assert.equal(r.status,413);assert.equal(calls,1);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
