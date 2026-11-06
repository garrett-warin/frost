import {token,hash,hmac,equal,isToken,requireThat} from './security.mjs';

export function signInternal(secret,path,body,now=Math.floor(Date.now()/1000)){
 const nonce=token(),timestamp=String(now);
 const signature=hmac(secret,`${timestamp}\n${nonce}\nPOST\n${path}\n${hash(body)}`);
 return {'x-frost-time':timestamp,'x-frost-nonce':nonce,'x-frost-signature':signature,'content-type':'application/json'};
}
export async function verifyInternal(accounts,path,body,headers){
 const {atomic}=await import('./store.mjs');
 const {store,config,now}=accounts;
 const secret=['/internal/redeem','/internal/refresh','/internal/check','/internal/connection','/internal/design','/internal/history','/internal/notification-read'].includes(path)?config.browseSecret||config.internalSecret:config.internalSecret;
 const timestamp=headers['x-frost-time'],nonce=headers['x-frost-nonce'],signature=headers['x-frost-signature'];
 requireThat(secret?.length>=32&&/^\d{10}$/.test(timestamp||'')&&Math.abs(now()-Number(timestamp))<=60&&isToken(nonce),401,'Invalid internal request.');
 requireThat(equal(signature,hmac(secret,`${timestamp}\n${nonce}\nPOST\n${path}\n${hash(body)}`)),401,'Invalid internal request.');
 await atomic(store,async tx=>{const id='internal-nonce:'+hash(nonce);requireThat(!await tx.get(id),401,'Internal request already used.');await tx.put(id,{expires:now()+180});});
}
