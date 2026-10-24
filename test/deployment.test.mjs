import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { get } from 'node:http';
import { connect as tcpConnect } from 'node:net';
import WebSocket from 'ws';
import { createFrostServer } from '../server.mjs';
test('production origin validates HTTP and WebSocket requests', async () => {
  const publicOrigin = 'https://frost-browsing.fly.dev';
  const edgeOrigin = 'https://d29bikvk0kgibf.cloudfront.net';
  const extraOrigins = ['https://dextra1.cloudfront.net','https://dextra2.cloudfront.net'];
  const app = createFrostServer({publicOrigin,edgeOrigin,edgeOrigins:extraOrigins.join(',')}).listen(0, '127.0.0.1');
  await once(app, 'listening');
  const address = `http://127.0.0.1:${app.address().port}`;
  const status = host => new Promise((resolve,reject) => get(address+'/health', {headers:{Host:host}}, response => {response.resume();resolve(response.statusCode)}).on('error',reject));
  try {
    assert.equal(await status('frost-browsing.fly.dev'),200);
    assert.equal(await status('attacker.example'),403);
    for(const origin of [publicOrigin,edgeOrigin,...extraOrigins,'https://other.cloudfront.net','https://attacker.example',undefined]) {
      const ws = new WebSocket(address.replace('http:', 'ws:')+'/relay/', {origin,headers:{Host:'frost-browsing.fly.dev'}});
      const result = await new Promise((resolve,reject) => {
        ws.on('open',()=>resolve(101));
        ws.on('unexpected-response',(_,res)=>{res.resume();ws.terminate();resolve(res.statusCode)});
        ws.on('error', error => {if([publicOrigin,edgeOrigin,...extraOrigins].includes(origin)) reject(error)});
      });
      assert.equal(result,[publicOrigin,edgeOrigin,...extraOrigins].includes(origin)?101:403);
      ws.terminate();
    }
  } finally {app.closeAllConnections(); await new Promise(resolve => app.close(resolve));}
});
test('public origin configuration rejects unsafe values', () => {
 assert.throws(()=>createFrostServer({publicOrigin:'https://frost-browsing.fly.dev',edgeOrigins:'https://dgood.cloudfront.net,https://bad.example'}));
 for(const edgeOrigin of ['http://d123.cloudfront.net','https://d123.cloudfront.net/path','https://user@d123.cloudfront.net','https://example.com']) assert.throws(()=>createFrostServer({publicOrigin:'https://frost-browsing.fly.dev',edgeOrigin}));
 assert.throws(()=>createFrostServer({edgeOrigin:'https://d123.cloudfront.net'}));
 for(const publicOrigin of ['http://example.com','https://example.com/path','https://user:pass@example.com']) assert.throws(()=>createFrostServer({publicOrigin}));
});

test('client reset during asynchronous device authorization cannot crash the server',async()=>{
 let entered,release;
 const started=new Promise(resolve=>entered=resolve), gate=new Promise(resolve=>release=resolve);
 const app=createFrostServer({adminOrigin:'https://dadmin.cloudfront.net',deviceStatusFetch:async()=>{entered();await gate;return {ok:true,json:async()=>({banned:false})};}}).listen(0,'127.0.0.1');
 await once(app,'listening');const port=app.address().port;
 const socket=tcpConnect(port,'127.0.0.1');socket.on('error',()=>{});
 try {
  await once(socket,'connect');
  socket.write(`GET /relay/ HTTP/1.1\r\nHost: localhost:${port}\r\nOrigin: http://localhost:${port}\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nCookie: frost-device=ed9e663c-40c6-46d4-97a4-142bb4897c85\r\n\r\n`);
  await started;socket.resetAndDestroy();
  await new Promise(resolve=>setTimeout(resolve,30));release();
  assert.equal((await fetch(`http://localhost:${port}/health`)).status,200);
 } finally {release();socket.destroy();app.closeAllConnections();await new Promise(resolve=>app.close(resolve));}
});

test('relay requires a device cookie and disconnects a newly banned active browser', {timeout:25000}, async()=>{
 let banned=false;
 const app=createFrostServer({adminOrigin:'https://dadmin.cloudfront.net',deviceStatusFetch:async()=>({ok:true,json:async()=>({banned})})}).listen(0,'127.0.0.1');
 await once(app,'listening');
 const origin=`http://localhost:${app.address().port}`;
 const connect=cookie=>new WebSocket(origin.replace('http:','ws:')+'/relay/',{origin,headers:cookie?{Cookie:cookie}:{}});
 let active;
 try {
  const missing=connect();missing.on('error',()=>{});
  const rejected=await new Promise(resolve=>missing.on('unexpected-response',(_,res)=>{res.resume();missing.terminate();resolve(res.statusCode)}));
  assert.equal(rejected,503);
  const response=await fetch(origin+'/api/device');assert.equal(response.status,200);
  const cookie=response.headers.get('set-cookie').split(';')[0];
  active=connect(cookie);await once(active,'open');
  banned=true;await once(active,'close');
  const status=await fetch(origin+'/api/device',{headers:{Cookie:cookie}});
  assert.equal(status.status,403);assert.equal((await status.json()).banned,true);
  const blocked=connect(cookie);blocked.on('error',()=>{});
  assert.equal(await new Promise(resolve=>blocked.on('unexpected-response',(_,res)=>{res.resume();blocked.terminate();resolve(res.statusCode)})),403);
 } finally {active?.terminate();app.closeAllConnections();await new Promise(resolve=>app.close(resolve));}
});

import { initializeTransportOnce } from '../public/transport.mjs';
test('download-first transport initialization is shared and awaited', async () => {
 let calls=0;
 const transport={async init(){calls++; await Promise.resolve(); this.session={};}, request(){assert.ok(this.session); return 'download';}};
 const startup=initializeTransportOnce(transport);
 await Promise.all([startup,transport.init(),transport.init()]);
 assert.equal(transport.request(),'download');
 assert.equal(calls,1);
});

test('announcement is readable but visitors cannot publish or remove it', async () => {
 const message='<script>literal announcement</script>';
 const app=createFrostServer({announcement:message}).listen(0,'127.0.0.1');
 await once(app,'listening');
 const url=`http://localhost:${app.address().port}/api/announcement`;
 try {
  assert.deepEqual(await (await fetch(url)).json(),{message});
  for(const method of ['POST','PUT','PATCH','DELETE']) assert.equal((await fetch(url,{method,body:'overwrite'})).status,405);
  assert.deepEqual(await (await fetch(url)).json(),{message});
 } finally {app.closeAllConnections(); await new Promise(resolve=>app.close(resolve));}
});
