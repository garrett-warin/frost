"""OVH root: back up and stage the exact new public hosts, without reassigning users."""
import json
import pathlib
import shutil
import subprocess
import os

os.umask(0o077)
root = pathlib.Path('/opt/frost/production')
backup = pathlib.Path('/opt/frost/releases/before-fresh-links-20261105')
backup.mkdir(mode=0o700, exist_ok=False)
manifest = json.loads(pathlib.Path('/home/debian/frost-import/fresh-links-20261105.json').read_text())
hosts = [d['domain'] for d in manifest['new'] if d['role'] == 'browser']
account = next(d['domain'] for d in manifest['new'] if d['role'] == 'accounts')
assert len(hosts) == len(set(hosts)) == 15
for name in ['accounts.env', 'admin.env', 'browser.env', 'Caddyfile']:
    shutil.copy2(root / name, backup / name)
shutil.copy2('/home/debian/frost-import/fresh-links-20261105.json', backup / 'manifest.json')

node = """
import {pool,transaction} from './postgres.mjs';
await transaction('accounts',async db=>{
const row=(await db.query("SELECT payload FROM frost_records WHERE namespace='accounts' AND id='deployment-config'")).rows[0];
if(row.payload.origin!=='https://d3mwcpxtmhbydi.cloudfront.net')throw Error('Unexpected canonical');
console.log(JSON.stringify(row.payload));
const aliases=[...new Set([...(row.payload.accountAliases||[]),NEW_ORIGIN])];
if(aliases.length>3)throw Error('Too many aliases');
await db.query("UPDATE frost_records SET payload=$1,version=version+1 WHERE namespace='accounts' AND id='deployment-config'",[{...row.payload,accountAliases:aliases}]);
});await pool.end();
""".replace('NEW_ORIGIN', json.dumps('https://' + account))

def env_update(name, changes):
    path = root / name
    values = dict(line.split('=', 1) for line in path.read_text().splitlines() if line and not line.startswith('#'))
    values.update(changes(values))
    path.write_text('\n'.join(k + '=' + v for k, v in values.items()) + '\n')

candidate = (root / 'Caddyfile').read_text()
needle = '    header X-Frost-Public-Host d3mwcpxtmhbydi.cloudfront.net'
assert candidate.count(needle) == 1
candidate = candidate.replace(needle, needle + '\n    header X-Frost-Public-Host ' + account)
(root / 'Caddyfile.fresh').write_text(candidate)
result = subprocess.run(['docker', 'run', '--rm', '--network', 'none', '--env-file', str(root/'gateway.env'), '-v', str(root/'Caddyfile.fresh')+':/etc/caddy/Caddyfile:ro', 'caddy:2-alpine', 'caddy', 'validate', '--config', '/etc/caddy/Caddyfile'], capture_output=True)
assert result.returncode == 0, 'Candidate Caddy validation failed; live configuration unchanged'
result = subprocess.run(['docker','exec','-i','frost-production-accounts-1','node','--input-type=module'],input=node,text=True,capture_output=True)
assert result.returncode == 0, 'Alias staging failed'
(backup/'deployment-config.json').write_text(result.stdout.strip())
env_update('accounts.env', lambda v: {'PUBLIC_HOSTS': v['PUBLIC_HOSTS'] + ',' + account})
env_update('browser.env', lambda v: {'FROST_EDGE_ORIGINS': v['FROST_EDGE_ORIGINS'] + ',' + ','.join('https://'+h for h in hosts)})
(root/'Caddyfile').write_text(candidate)
subprocess.run(['docker','compose','up','-d','--no-deps','accounts','browser'],cwd=root,check=True)
subprocess.run(['docker','restart','frost-production-gateway-1'],check=True)
print('STAGED new hosts; canonical dispenser and existing assignments unchanged')
