import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {aiConfig,providerRequest,validateChat,createAssistant} from '../assistant.mjs';

const config=aiConfig({FROST_AI_PROVIDER:'groq',GROQ_API_KEY:'groq-test-only',FROST_AI_API_KEY:'openrouter-test-only'});
const body={model:'openai/gpt-oss-20b',messages:[{role:'user',content:'Hello'}]};
const image={mimeType:'image/png',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC1lEQVR42mP8/x8AAwMCAO+a6XkAAAAASUVORK5CYII='};

test('Groq configuration isolates credentials and restricts endpoint and model selection',()=>{
 assert.equal(config.key,'groq-test-only');
 assert.equal(config.endpoint,'https://api.groq.com/openai/v1');
 assert.equal(aiConfig({FROST_AI_PROVIDER:'groq',FROST_AI_API_KEY:'old-key',FROST_AI_BASE_URL:'https://other.invalid'}).key,'');
 assert.equal(config.models.length,3);assert.equal(config.models[2].supportsImages,true);assert.match(config.models[2].name,/preview/);
 assert.throws(()=>aiConfig({FROST_AI_PROVIDER:'unknown'}));
 assert.throws(()=>aiConfig({FROST_AI_PROVIDER:'groq',FROST_AI_MODELS:'arbitrary-model'}));
 assert.throws(()=>aiConfig({FROST_AI_PROVIDER:'openrouter',FROST_AI_BASE_URL:'https://other.invalid/v1'}));
 assert.throws(()=>aiConfig({FROST_AI_MODELS:'openai/gpt-oss-20b'}));
 assert.equal(createAssistant({config}).info().key,undefined);
});

test('Groq payloads suppress reasoning, retain vision, and exclude OpenRouter routing fields',()=>{
 const messages=validateChat(body,config.models),payload=providerRequest(config,body.model,messages);
 assert.equal(payload.include_reasoning,false);assert.equal(payload.reasoning_effort,'low');
 assert.equal(payload.max_completion_tokens,2048);assert.equal(payload.provider,undefined);assert.equal(payload.store,undefined);assert.equal(payload.max_tokens,undefined);
 const vision={...body,model:'qwen/qwen3.8-27b',image};
 const multimodal=providerRequest(config,vision.model,validateChat(vision,config.models));
 assert.equal(multimodal.reasoning_effort,'none');assert.equal(multimodal.include_reasoning,undefined);
 assert.match(multimodal.messages.at(-1).content[1].image_url.url,/^data:image\/png;base64,/);
 assert.throws(()=>validateChat({...body,image},config.models),/image-capable/);
});

test('Groq conservative prompt budget counts UTF-8 and reserves image and output tokens',()=>{
 assert.doesNotThrow(()=>providerRequest(config,body.model,[{role:'user',content:'x'.repeat(5440)}]));
 assert.throws(()=>providerRequest(config,body.model,[{role:'user',content:'x'.repeat(5441)}]),/prompt budget/);
 assert.throws(()=>providerRequest(config,body.model,[{role:'user',content:'雪'.repeat(2000)}]),/prompt budget/);
 const content=[{type:'text',text:'x'.repeat(3392)},{type:'image_url',image_url:{url:'data:image/png;base64,'+'A'.repeat(100000)}}];
 assert.doesNotThrow(()=>providerRequest(config,'qwen/qwen3.8-27b',[{role:'user',content}]));
 content[0].text+='x';assert.throws(()=>providerRequest(config,'qwen/qwen3.8-27b',[{role:'user',content}]),/prompt budget/);
});

test('Groq HTTP streams only answer, rejects oversized prompts locally, and forwards bounded retry hints',async()=>{
 let calls=0,mode='success';
 const assistant=createAssistant({config,fetcher:async(url,args)=>{
  calls++;assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');assert.equal(args.headers.Authorization,'Bearer groq-test-only');
  if(mode==='limited')return new Response('private provider detail',{status:429,headers:{'Retry-After':'120'}});
  if(mode==='large')return new Response('private provider detail',{status:413});
  return new Response('data: {"choices":[{"delta":{"reasoning":"private reasoning","content":"Hello"}}]}\n\ndata: [DONE]\n\n');
 }});
 const server=createServer((req,res)=>assistant.handle(req,res,{device:'groq-test',allowedOrigins:['http://frost.test'],checkBan:async()=>false})).listen(0,'127.0.0.1');await once(server,'listening');
 const post=payload=>fetch(`http://127.0.0.1:${server.address().port}`,{method:'POST',headers:{Origin:'http://frost.test','Content-Type':'application/json'},body:JSON.stringify(payload)});
 try{
  let response=await post({...body,messages:[{role:'user',content:'x'.repeat(6000)}]});assert.equal(response.status,400);assert.equal(calls,0);
  response=await post(body);assert.equal(response.status,200);const result=await response.text();assert.match(result,/Hello/);assert.doesNotMatch(result,/reasoning|groq-test-only/);
  mode='limited';response=await post(body);assert.equal(response.status,429);assert.equal(response.headers.get('Retry-After'),'120');assert.doesNotMatch(await response.text(),/private provider/);
  mode='large';response=await post(body);assert.equal(response.status,413);assert.match(await response.text(),/token limit/);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
