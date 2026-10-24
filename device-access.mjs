import { randomUUID } from 'node:crypto';
export const validDevice = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
export function createDeviceAccess({adminOrigin, secure=true, fetchStatus=fetch, now=Date.now}) {
 const name=secure?'__Host-frost-device':'frost-device';
 const cache=new Map();
 function read(req){const id=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1);return validDevice(id)?id:null;}
 function issue(res){const id=randomUUID();res.setHeader('Set-Cookie',`${name}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure?'; Secure':''}`);return id;}
 async function banned(id){
  if(!validDevice(id))throw new Error('Device cookie required. Reload Frost.');
  if(!adminOrigin)return false;
  const existing=cache.get(id);if(existing && now()-existing.time<10000)return existing.banned;
  const response=await fetchStatus(adminOrigin+'/device/check/'+id,{signal:AbortSignal.timeout(4000)});
  if(!response.ok)throw new Error('Device access check unavailable. Try again shortly.');
  const data=await response.json();if(typeof data.banned!=='boolean')throw new Error('Invalid device status.');
  if(cache.size>=10000)cache.delete(cache.keys().next().value);
  cache.set(id,{time:now(),banned:data.banned});return data.banned;
 }
 return {read,issue,banned};
}
