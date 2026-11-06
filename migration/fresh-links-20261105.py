"""Run in authenticated CloudShell. Stage disabled clones before OVH cutover.

Private configurations stay in CloudShell; stdout contains public identifiers only.
"""
import copy
import json
import os
import pathlib
import sys

import boto3
from botocore.config import Config

os.umask(0o077)
ROOT = pathlib.Path.home() / 'frost-fresh-links-20261105'
ROOT.mkdir(mode=0o700, exist_ok=True)
MANIFEST = ROOT / 'manifest.json'
cf = boto3.client('cloudfront', config=Config(retries={'mode':'adaptive','max_attempts':20}))
sources = {'browser': 'd2srxc54b294vy.cloudfront.net',
           'accounts': 'd3mwcpxtmhbydi.cloudfront.net'}


def save(value):
    temporary = ROOT / 'manifest.tmp'
    temporary.write_text(json.dumps(value, indent=2))
    temporary.replace(MANIFEST)


def load():
    return json.loads(MANIFEST.read_text())


step = sys.argv[1]
if step == 'create':
    distributions = [d for p in cf.get_paginator('list_distributions').paginate()
                     for d in p.get('DistributionList', {}).get('Items', [])]
    state = load() if MANIFEST.exists() else {'new': [], 'sources': {}}
    for role, domain in sources.items():
        if role not in state['sources']:
            matches = [d for d in distributions if d['DomainName'] == domain]
            assert len(matches) == 1, 'Source distribution missing'
            response = cf.get_distribution_config(Id=matches[0]['Id'])
            config = response['DistributionConfig']
            assert config['Enabled'] and config['Origins']['Quantity'] == 1
            assert not config.get('Aliases', {}).get('Quantity')
            assert config['Origins']['Items'][0]['DomainName'] == 'vps-273aa89f.vps.ovh.ca'
            (ROOT / (role + '-source.json')).write_text(json.dumps(response))
            state['sources'][role] = matches[0]['Id']
            save(state)
        config = json.loads((ROOT / (role + '-source.json')).read_text())['DistributionConfig']
        for index in range(15 if role == 'browser' else 1):
            label = role + '-' + str(index + 1)
            if any(d['label'] == label for d in state['new']):
                continue
            clone = copy.deepcopy(config)
            clone.update(CallerReference='frost-fresh-20261105-' + label,
                         Comment='Frost fresh 2026-11-05 ' + label, Enabled=False)
            result = cf.create_distribution(DistributionConfig=clone)['Distribution']
            state['new'].append({'label': label, 'role': role, 'id': result['Id'], 'domain': result['DomainName']})
            save(state)
            print(label, result['Id'], result['DomainName'], flush=True)
    assert len(state['new']) == 16
    print('STAGED 16 disabled distributions', flush=True)
elif step == 'activate':
    state = load()
    assert len(state['new']) == 16
    for dist in state['new']:
        current = cf.get_distribution_config(Id=dist['id'])
        config = current['DistributionConfig']
        headers = config['Origins']['Items'][0]['CustomHeaders']['Items']
        public = [h for h in headers if h['HeaderName'].lower() == 'x-frost-public-host']
        assert len(public) == 1
        public[0]['HeaderValue'] = dist['domain']
        config['Enabled'] = True
        cf.update_distribution(Id=dist['id'], IfMatch=current['ETag'], DistributionConfig=config)
        print('ACTIVATING', dist['domain'], flush=True)
elif step == 'status':
    for dist in load()['new']:
        current = cf.get_distribution(Id=dist['id'])['Distribution']
        print(dist['role'], dist['domain'], current['Status'], current['DistributionConfig']['Enabled'], flush=True)
elif step == 'public':
    print(json.dumps(load()))
elif step in ['disable-old', 'old-status']:
    old = ['d18pizaz65wabf','du88h8kerz0cp','d3e3kj3ww0e0eh','djknofmmxg2b9','d3qqn7jtiigd7i','d2q31xn8fcj0tg','d2ho3tfmm3mv7m','d19xfihozfhn60','dl3blvmdwt77i','d1tfvvgz2yj2k5','d25iw9gptmkr1e','d2srxc54b294vy','d3kkjy11sjy54y','d26biuvj6blvsp','dlktq12hsc86y']
    targets = {x + '.cloudfront.net' for x in old}
    matches = [d for page in cf.get_paginator('list_distributions').paginate()
               for d in page.get('DistributionList', {}).get('Items', []) if d['DomainName'] in targets]
    assert len(matches) == 15
    if step == 'disable-old':
        assert (ROOT/'cutover-verified').exists(), 'Verify OVH cutover first'
        for dist in load()['new']:
            current = cf.get_distribution(Id=dist['id'])['Distribution']
            assert current['Status'] == 'Deployed' and current['DistributionConfig']['Enabled']
    for dist in matches:
        current = cf.get_distribution(Id=dist['Id'])['Distribution']
        if step == 'old-status':
            print(dist['DomainName'], current['Status'], current['DistributionConfig']['Enabled'], flush=True)
            continue
        response = cf.get_distribution_config(Id=dist['Id'])
        config = response['DistributionConfig']
        headers = config['Origins']['Items'][0]['CustomHeaders']['Items']
        assert any(h['HeaderName'].lower() == 'x-frost-service' and h['HeaderValue'] == 'browser' for h in headers)
        backup = ROOT / ('old-' + dist['Id'] + '.json')
        if not backup.exists():
            backup.write_text(json.dumps(response))
        if not config['Enabled']:
            print('ALREADY DISABLED', dist['DomainName'], flush=True)
            continue
        config['Enabled'] = False
        cf.update_distribution(Id=dist['Id'], IfMatch=response['ETag'], DistributionConfig=config)
        print('DISABLING', dist['DomainName'], flush=True)
else:
    raise SystemExit('Use create, activate, status, public, disable-old or old-status')
