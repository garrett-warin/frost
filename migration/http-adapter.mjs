import {createServer} from 'node:http';
import {createHash,timingSafeEqual} from 'node:crypto';
export function matches(actual,expected) {
  if(typeof actual!=='string'||typeof expected!=='string'||expected.length<32)return false;
  return timingSafeEqual(createHash('sha256').update(actual).digest(),createHash('sha256').update(expected).digest());
}
async function body(req) {
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>280*1024){const error=Error('Request too large');error.status=413;throw error;}chunks.push(chunk);}
  return Buffer.concat(chunks).toString('utf8');
}
const reply=(res,status,value)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value));};
export function publicServer({handler,originKey,allowedHosts}) {
  if(!originKey||originKey.length<32||!allowedHosts?.length)throw Error('Missing origin protection');
  return createServer(async(req,res)=>{
    try {
      if(!matches(req.headers['x-frost-origin-key'],originKey)||!allowedHosts.includes(req.headers['x-frost-public-host']))return reply(res,403,{error:'Forbidden'});
      const url=new URL(req.url,'https://'+req.headers['x-frost-public-host']);
                                                                                     
      const event={version:'2.0',rawPath:url.pathname,rawQueryString:url.search.slice(1),headers:{...req.headers,host:req.headers['x-frost-public-host']},requestContext:{http:{method:req.method,sourceIp:req.socket.remoteAddress}},body:await body(req),isBase64Encoded:false};
      delete event.headers['x-frost-origin-key'];
      const result=await handler(event);
      res.writeHead(result.statusCode||500,{...result.headers,...(result.cookies?.length?{'set-cookie':result.cookies}:{})});
      res.end(result.isBase64Encoded?Buffer.from(result.body||'','base64'):result.body||'');
    }catch(error){if(!res.headersSent)reply(res,error.status||503,{error:error.status===413?'Request too large':'Service unavailable'});else res.end();}
  });
}
export function privateServer({handler,bridgeKey,role}) {
  if(!bridgeKey||bridgeKey.length<32||!['accounts','admin'].includes(role))throw Error('Missing bridge protection');
  return createServer(async(req,res)=>{
    try {
      if(req.method!=='POST'||req.url!=='/invoke'||!matches(req.headers.authorization,'Bearer '+bridgeKey))return reply(res,403,{error:'Forbidden'});
      const value=JSON.parse(await body(req));
      if(!value||typeof value!=='object'||Array.isArray(value))return reply(res,400,{error:'Invalid request'});
      const event=role==='accounts'?{source:'frost.admin',action:value.action,body:value.body||{}}:{source:'frost.account-admin',path:value.path,body:value.body||{}};
      reply(res,200,await handler(event));
    }catch{reply(res,503,{error:'Private service unavailable'});}
  });
}
