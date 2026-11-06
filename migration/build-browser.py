import pathlib,hashlib,tarfile,sys
archive,dest=map(pathlib.Path,sys.argv[1:3])
assert hashlib.sha256(archive.read_bytes()).hexdigest()=='8fcb5c0d80aadec9b1cd6c1edaf483e7adca1d3b584315336f67dd512bb8a3e9','Review changed live browser artifact first'
dest.mkdir(parents=True,exist_ok=True)
with tarfile.open(archive) as tar:tar.extractall(dest,filter='data')
def change(file,old,new):
    p=dest/file;s=p.read_text(encoding='utf-8');assert s.count(old)==1,'Unexpected browser source: '+file;s=s.replace(old,new,1);p.write_text(s,encoding='utf-8')
change('server.mjs','  let cached,pending;',"  if(machineId==='ovh-bhs-1') return async()=>({checkedAt:now(),topology:'single',servers:[{name:'Canada - Beauharnois',status:'healthy'}]});\n  let cached,pending;")
change('server.mjs','machineId = process.env.FLY_MACHINE_ID || "local"','machineId = process.env.FROST_SERVER_ID || process.env.FLY_MACHINE_ID || "local"')
change('server.mjs','const serverLabel = machineId ===','const serverLabel = machineId === "ovh-bhs-1" ? "Canada - Beauharnois" : machineId ===')
change('server.mjs','JSON.stringify({ok:true,machine:machineId})','JSON.stringify({ok:true,service:"frost",machine:machineId})')
change('public/outage-banner.mjs','data.servers.length !== 2','!([1,2].includes(data.servers.length))')
change('public/outage-banner.mjs',"  if (healthy === 2) return '';","  if (healthy === data.servers.length) return '';\n  if(data.servers.length===1) return 'Outage: Frost’s server is not responding normally. Please try again shortly.';")
change('public/server-health.mjs',"heading.textContent='Fly servers'","heading.textContent='Frost servers'")
change('public/server-health.mjs','data.servers.length!==2','![1,2].includes(data.servers.length)')
print('Exact browser artifact adapted for one OVH server')
