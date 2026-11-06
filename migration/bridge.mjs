export async function invokeBridge(body) {
  const origin=process.env.BRIDGE_ORIGIN;
  if(!['http://accounts:9001','http://admin:9001'].includes(origin))throw Error('Invalid private bridge target');
  const response=await fetch(origin+'/invoke',{method:'POST',headers:{authorization:'Bearer '+process.env.BRIDGE_KEY,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Private bridge unavailable');
  const result=await response.json();
  if(!Number.isInteger(result.statusCode)||!result.data)throw Error('Invalid private bridge response');
  return result;
}
