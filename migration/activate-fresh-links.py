"""OVH root: apply validated pool migration, canonical origin and old entry redirects."""
import json
import pathlib
import subprocess
import os
os.umask(0o077)
root=pathlib.Path('/opt/frost/production')
manifest_path=pathlib.Path('/home/debian/frost-import/fresh-links-20261105.json')
manifest=json.loads(manifest_path.read_text())
origins=['https://'+d['domain'] for d in manifest['new'] if d['role']=='browser']
account=next(d['domain'] for d in manifest['new'] if d['role']=='accounts')
assert len(origins)==15
candidate=(root/'Caddyfile').read_text()
needle='  handle @accounts {\n    reverse_proxy accounts:8080'
assert candidate.count(needle)==1
redirect=f'''  handle @accounts {{
    @oldEntry {{
      header X-Frost-Public-Host d3mbml114oiqni.cloudfront.net
      header X-Frost-Public-Host d3mwcpxtmhbydi.cloudfront.net
      method GET HEAD
      not path /api /api/* /forms /forms/* /internal /internal/*
    }}
    redir @oldEntry https://{account}{{uri}} 302
    reverse_proxy accounts:8080'''
candidate=candidate.replace(needle,redirect)
(root/'Caddyfile.fresh-final').write_text(candidate)
checked=subprocess.run(['docker','run','--rm','--network','none','--env-file',str(root/'gateway.env'),'-v',str(root/'Caddyfile.fresh-final')+':/etc/caddy/Caddyfile:ro','caddy:2-alpine','caddy','validate','--config','/etc/caddy/Caddyfile'],capture_output=True)
assert checked.returncode==0,'Caddy candidate failed validation; no switch performed'
subprocess.run(['docker','exec','-i','frost-production-accounts-1','node','switch-fresh-links.mjs','--apply'],input=manifest_path.read_text(),text=True,check=True)
for name in ['accounts.env','admin.env','browser.env']:
 path=root/name
 values=dict(line.split('=',1) for line in path.read_text().splitlines() if line and not line.startswith('#'))
 if name=='accounts.env':values['PUBLIC_HOSTS']=account+',d3mbml114oiqni.cloudfront.net,d3mwcpxtmhbydi.cloudfront.net'
 if name in ['accounts.env','admin.env']:values['FROST_PRESENCE_ORIGIN']=origins[0]
 if name=='browser.env':values.update(FROST_DISPENSER_ORIGIN='https://'+account,FROST_EDGE_ORIGIN=origins[0],FROST_EDGE_ORIGINS=','.join(origins[1:]))
 path.write_text('\n'.join(k+'='+v for k,v in values.items())+'\n')
(root/'Caddyfile').write_text(candidate)
subprocess.run(['docker','compose','up','-d','--no-deps','accounts','admin','browser'],cwd=root,check=True)
subprocess.run(['docker','restart','frost-production-gateway-1'],check=True)
print('CANONICAL CUTOVER COMPLETE')
