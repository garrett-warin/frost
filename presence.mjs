// Approximate anonymous browser activity. State is bounded and expires quickly.
export function createPresence({now=Date.now,ttl=75000,limit=10000}={}) {
 const visitors=new Map();
 return id=>{
  const time=now();
  for(const [key,seen] of visitors) if(time-seen>=ttl) visitors.delete(key);
  if(id!==null){
   if(!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid visitor ID');
   if(!visitors.has(id)&&visitors.size>=limit) throw new Error('Presence capacity reached');
   visitors.set(id,time);
  }
  return visitors.size;
 };
}
