"""CloudShell: prepare exact origin changes; this script never applies them."""
import boto3,pathlib,json,copy,os
os.umask(0o077)
p=pathlib.Path.home()/'frost-ovh-migration-20261104'
cf=boto3.client('cloudfront');d=boto3.client('dynamodb');l=boto3.client('lambda')
routing=json.loads((p/'origin-routing.json').read_text())
account=l.get_function_configuration(FunctionName='frost-accounts-Function-qqSxuvfShn08')
table=account['Environment']['Variables']['FROST_PLATFORM_TABLE']
settings=json.loads(d.get_item(TableName=table,Key={'id':{'S':'deployment-config'}},ConsistentRead=True)['Item']['payload']['S'])
domains={x.removeprefix('https://'):'browser' for x in settings['endpoints'] if x.endswith('.cloudfront.net')}
domains['d3mbml114oiqni.cloudfront.net']='accounts';domains['d2ftxdtd3x015d.cloudfront.net']='admin'
plan=[]
for page in cf.get_paginator('list_distributions').paginate():
 for dist in page.get('DistributionList',{}).get('Items',[]):
  role=domains.get(dist['DomainName'])
  if not role:continue
  old=cf.get_distribution_config(Id=dist['Id']);cfg=copy.deepcopy(old['DistributionConfig'])
  assert cfg['Enabled'] and cfg['Origins']['Quantity']==1,'Unexpected origin topology'
                                                                                  
  for behavior in [cfg['DefaultCacheBehavior']]+cfg.get('CacheBehaviors',{}).get('Items',[]):
   if behavior.get('ForwardedValues',{}).get('Headers',{}).get('Items'):
    assert not any(h.lower() in ['host','*'] for h in behavior['ForwardedValues']['Headers']['Items']),'Viewer Host forwarded'
   policy=behavior.get('OriginRequestPolicyId')
   if policy:
    headers=cf.get_origin_request_policy(Id=policy)['OriginRequestPolicy']['OriginRequestPolicyConfig']['HeadersConfig']
    behavior_type=headers['HeaderBehavior'];items=[h.lower() for h in headers.get('Headers',{}).get('Items',[])]
    assert behavior_type not in ['allViewer','allViewerAndWhitelistCloudFront'] and not(behavior_type=='whitelist' and 'host' in items) and not(behavior_type=='allExcept' and 'host' not in items),'Viewer Host forwarded'
   cache=behavior.get('CachePolicyId')
   if cache:
    headers=cf.get_cache_policy(Id=cache)['CachePolicy']['CachePolicyConfig']['ParametersInCacheKeyAndForwardedToOrigin']['HeadersConfig']
    assert 'host' not in [h.lower() for h in headers.get('Headers',{}).get('Items',[])],'Cache policy forwards viewer Host'
  origin=cfg['Origins']['Items'][0]
  assert not origin.get('OriginPath'),'Unexpected origin path prefix'
  origin['DomainName']=routing['origin']
  for key in ['OriginAccessControlId','S3OriginConfig','VpcOriginConfig']:origin.pop(key,None)
  origin['CustomOriginConfig']={'HTTPPort':80,'HTTPSPort':443,'OriginProtocolPolicy':'https-only','OriginSslProtocols':{'Quantity':1,'Items':['TLSv1.2']},'OriginReadTimeout':60,'OriginKeepaliveTimeout':60}
  names={'x-frost-service','x-frost-origin-key','x-frost-public-host'}
  headers=[x for x in origin.get('CustomHeaders',{}).get('Items',[]) if x['HeaderName'].lower() not in names]
  headers += [{'HeaderName':'X-Frost-Service','HeaderValue':role},{'HeaderName':'X-Frost-Origin-Key','HeaderValue':routing['keys'][role]},{'HeaderName':'X-Frost-Public-Host','HeaderValue':dist['DomainName']}]
  origin['CustomHeaders']={'Quantity':len(headers),'Items':headers}
  plan.append({'id':dist['Id'],'domain':dist['DomainName'],'role':role,'etag':old['ETag'],'before':old['DistributionConfig'],'after':cfg})
assert len(plan)==len(domains),'Missing distribution'
(p/'cutover-plan.json').write_text(json.dumps(plan))
print('Prepared',len(plan),'distributions:',{role:sum(x['role']==role for x in plan) for role in ['browser','accounts','admin']})
print('No origins changed. Existing addresses, policies and routing behaviors retained.')
