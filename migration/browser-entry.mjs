                                                                                     
const originalFetch=globalThis.fetch;
const routes=new Map([
  [process.env.FROST_DISPENSER_ORIGIN,{target:'http://accounts:8080',key:process.env.ACCOUNTS_ORIGIN_KEY}],
  [process.env.FROST_ADMIN_ORIGIN,{target:'http://admin:8080',key:process.env.ADMIN_ORIGIN_KEY}]
]);
globalThis.fetch=(input,init={})=>{
  const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
  const route=routes.get(url.origin);
  if(!route)return originalFetch(input,init);
  const headers=new Headers(init.headers);
  headers.set('x-frost-origin-key',route.key);headers.set('x-frost-public-host',url.host);
  return originalFetch(route.target+url.pathname+url.search,{...init,headers});
};
const {createFrostServer}=await import('./server.mjs');
const server=createFrostServer().listen(8080,'0.0.0.0',()=>console.log('Frost OVH browser ready'));
process.on('SIGTERM',()=>{server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),10000).unref();});
