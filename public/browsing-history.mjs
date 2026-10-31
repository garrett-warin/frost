// Only newly observed visits are sent. Never read or backfill local history.
export async function reportVisit(visit,fetcher=fetch){
 try{
  const url=new URL(visit.url);if(!['http:','https:'].includes(url.protocol))return;
  url.username='';url.password='';url.search='';url.hash='';
  await fetcher('/api/account/history',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:url.href,title:String(visit.title||'').slice(0,300)}),signal:AbortSignal.timeout(6000)});
 }catch{/* History delivery is best effort and never blocks navigation. */}
}
