"""Explicit CloudShell cutover steps. Never run apply/freeze during rehearsal."""
import boto3,pathlib,json,sys,os,hashlib,time,copy
os.umask(0o077)
p=pathlib.Path.home()/'frost-ovh-migration-20261104'
l=boto3.client('lambda');d=boto3.client('dynamodb');cf=boto3.client('cloudfront')
functions={'accounts':'frost-accounts-Function-qqSxuvfShn08','admin':'frost-admin-Function-EdCFDwgOTrcP'}
expected={'accounts':'9m3jCGAf2IoiyD0JPsecqFzmlYddnj1HMFMYJ9VVMdM=','admin':'G4BsavxMvqito/EhlKYR9/qTIFEotXEUdTtnB7siXlw='}
step=sys.argv[1]
plan=json.loads((p/'cutover-plan.json').read_text())
def same_config(a,b):
    def normalize(value):
        value=copy.deepcopy(value)
        for origin in value.get('Origins',{}).get('Items',[]):
            if origin.get('OriginAccessControlId')=='':origin.pop('OriginAccessControlId')
            headers=origin.get('CustomHeaders',{}).get('Items',[])
            for header in headers:header['HeaderName']=header['HeaderName'].lower()
            headers.sort(key=lambda header:header['HeaderName'])
        return value
    return normalize(a)==normalize(b)
if step=='freeze':
    assert not (p/'opened.marker').exists(),'OVH already opened; reconciliation required'
    if not (p/'concurrency-before.json').exists():
        previous={role:l.get_function_concurrency(FunctionName=name).get('ReservedConcurrentExecutions') for role,name in functions.items()}
        (p/'concurrency-before.json').write_text(json.dumps(previous))
    drain=60
    for role,name in functions.items():
        config=l.get_function_configuration(FunctionName=name)
        assert config['CodeSha256']==expected[role],'Live code changed; stop'
        captured=json.loads((p/(role+'-configuration.json')).read_text())
        assert config.get('Environment',{}).get('Variables',{})==captured.get('Environment',{}).get('Variables',{}),'Live environment changed; stop and review privately'
        drain=max(drain,config['Timeout']+5)
    for role,name in functions.items():
        l.put_function_concurrency(FunctionName=name,ReservedConcurrentExecutions=0)
    (p/'frozen-at.txt').write_text(str(time.time()))
    (p/'drain-seconds.txt').write_text(str(drain))
    print('Both Lambda writers frozen. Wait at least',drain,'seconds before export.')
elif step=='export':
    assert time.time()-float((p/'frozen-at.txt').read_text())>=float((p/'drain-seconds.txt').read_text()),'Wait for in-flight invocations'
    for role,name in functions.items():
        assert l.get_function_concurrency(FunctionName=name).get('ReservedConcurrentExecutions')==0,'Writer not frozen'
        env=l.get_function_configuration(FunctionName=name)['Environment']['Variables'];table=env.get('FROST_PLATFORM_TABLE') or env['TABLE_NAME']
        file=p/(role+'-final.jsonl');count=0
        with file.open('w') as f:
            for page in d.get_paginator('scan').paginate(TableName=table,ConsistentRead=True):
                for item in page.get('Items',[]):f.write(json.dumps(item,separators=(',',':'))+'\n');count+=1
        print(role,'final rows',count,'sha256',hashlib.sha256(file.read_bytes()).hexdigest())
elif step=='apply':
    for name in functions.values():assert l.get_function_concurrency(FunctionName=name).get('ReservedConcurrentExecutions')==0,'Writer not frozen'
    for item in plan:
        current=cf.get_distribution_config(Id=item['id'])
        if same_config(current['DistributionConfig'],item['after']):continue
        assert current['ETag']==item['etag'],'CloudFront changed since plan; review before replacing'
        cf.update_distribution(Id=item['id'],IfMatch=current['ETag'],DistributionConfig=item['after'])
        print(item['role'],item['domain'],'origin update submitted',flush=True)
elif step=='status':
    pending=[]
    for item in plan:
        current=cf.get_distribution(Id=item['id'])['Distribution']
        correct=same_config(current['DistributionConfig'],item['after'])
        if current['Status']!='Deployed' or not correct:pending.append(item['domain'])
    print('Routing ready' if not pending else 'Pending: '+', '.join(pending))
elif step=='mark-open':
    for name in functions.values():assert l.get_function_concurrency(FunctionName=name).get('ReservedConcurrentExecutions')==0,'Old writer not frozen'
    for item in plan:
        current=cf.get_distribution(Id=item['id'])['Distribution']
        assert current['Status']=='Deployed' and same_config(current['DistributionConfig'],item['after']),'Routing is not ready'
    (p/'opened.marker').write_text('Rollback now requires OVH write reconciliation. Marked before gate opening: '+str(time.time()))
    print('Rollback boundary marked. Open OVH only after final import/integrity checks.')
elif step=='restore-before-open':
    assert not (p/'opened.marker').exists(),'After accepting writes, reconcile OVH before rollback'
    for item in plan:
        current=cf.get_distribution_config(Id=item['id'])
        if same_config(current['DistributionConfig'],item['before']):continue
        assert same_config(current['DistributionConfig'],item['after']),'Unexpected third-party config change'
        cf.update_distribution(Id=item['id'],IfMatch=current['ETag'],DistributionConfig=item['before'])
    for role,name in functions.items():
        value=json.loads((p/'concurrency-before.json').read_text())[role]
        if value is None:l.delete_function_concurrency(FunctionName=name)
        else:l.put_function_concurrency(FunctionName=name,ReservedConcurrentExecutions=value)
    print('Original AWS writers restored; CloudFront restoration propagating. OVH must remain closed.')
else:raise SystemExit('Choose freeze, export, apply, status, mark-open, or restore-before-open')
