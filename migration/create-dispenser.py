"""CloudShell: clone dispenser disabled, then explicitly activate after OVH preparation."""
import boto3,pathlib,json,uuid,os,sys
os.umask(0o077)
p=pathlib.Path.home()/'frost-dispenser-20261104';p.mkdir(exist_ok=True,mode=0o700)
cf=boto3.client('cloudfront');step=sys.argv[1]
if step=='create':
    assert not (p/'new.json').exists(),'Replacement already created'
    matches=[d for page in cf.get_paginator('list_distributions').paginate() for d in page.get('DistributionList',{}).get('Items',[]) if d['DomainName']=='d3mbml114oiqni.cloudfront.net']
    assert len(matches)==1
    before=cf.get_distribution_config(Id=matches[0]['Id'])
    (p/'before.json').write_text(json.dumps(before))
    config=before['DistributionConfig'];config['CallerReference']='frost-dispenser-'+str(uuid.uuid4());config['Comment']='Frost account dispenser replacement 2026-11-04';config['Enabled']=False
    assert not config.get('Aliases',{}).get('Quantity') and config['Origins']['Quantity']==1
    result=cf.create_distribution(DistributionConfig=config)['Distribution']
    data={'id':result['Id'],'domain':result['DomainName']};(p/'new.json').write_text(json.dumps(data));print(json.dumps(data))
elif step=='activate':
    data=json.loads((p/'new.json').read_text());current=cf.get_distribution_config(Id=data['id']);config=current['DistributionConfig']
    for h in config['Origins']['Items'][0]['CustomHeaders']['Items']:
        if h['HeaderName'].lower()=='x-frost-public-host':h['HeaderValue']=data['domain']
    config['Enabled']=True
    cf.update_distribution(Id=data['id'],IfMatch=current['ETag'],DistributionConfig=config)
    print('Activation submitted:',data['domain'])
elif step=='status':
    data=json.loads((p/'new.json').read_text());d=cf.get_distribution(Id=data['id'])['Distribution'];print(data['domain'],d['Status'],'enabled='+str(d['DistributionConfig']['Enabled']))
else:raise SystemExit('Choose create, activate or status')
