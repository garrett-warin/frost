import test from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createFrostServer} from '../server.mjs';
test('retired customization routes and malformed URLs leave the server healthy',async()=>{
 const server=createFrostServer().listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const get=path=>new Promise((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port:server.address().port,path,headers:{Host:'localhost:'+server.address().port}},r=>{r.resume();r.on('end',()=>resolve(r.statusCode));});req.on('error',reject);req.end();});
 try{for(const path of ['/customize','/%63ustomize/editor.bundle.mjs','/api/account/design'])assert.equal(await get(path),410);assert.equal(await get('//['),400);assert.equal(await get('/health'),200);}finally{await new Promise(r=>server.close(r));}
});
test('admin locking no longer depends on removed template elements',async()=>{
 const source=await readFile(new URL('../admin/admin.js',import.meta.url),'utf8');
 const start=source.indexOf('function lock(){'),end=source.indexOf('\n',start),nodes=new Map();
 const context=vm.createContext({$:id=>{assert.ok(!id.startsWith('template-'));if(!nodes.has(id))nodes.set(id,{close(){},replaceChildren(){}});return nodes.get(id);},ticketChatTimer:0,selectedTicket:null,ticketDrafts:new Map(),epoch:0,session:'secret',expiry:0,refreshTimer:0,verificationRows:[],refreshTarget:null,selected:null,nextAccount:null,cursors:{},clearTimeout(){},loadMaintenance(){}});
 vm.runInContext(source.slice(start,end)+'\nlock();',context);assert.equal(context.session,'');assert.equal(nodes.get('workspace').hidden,true);
});
