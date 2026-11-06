"""Synthetic pending-only probe. No accounts created; credentials stay in memory."""
import hashlib, hmac, json, subprocess, time, uuid
import requests
origin='https://d3mbml114oiqni.cloudfront.net'
cfg=json.loads(subprocess.check_output(['aws','lambda','get-function-configuration','--function-name','frost-accounts-Function-qqSxuvfShn08','--output','json']))
secret=cfg['Environment']['Variables']['FROST_FORMS_SECRET']
session=requests.Session()
email='verification-probe-'+uuid.uuid4().hex+'@example.com'
entry=json.dumps({'email':email},separators=(',',':'))
r=session.post(origin+'/api/entry',data=entry,headers={'Origin':origin,'Content-Type':'application/json','X-Amz-Content-Sha256':hashlib.sha256(entry.encode()).hexdigest()},timeout=20)
assert r.status_code==200, ('entry',r.status_code)
code=r.json()['siteCode']
def submit(address):
 body=json.dumps({'formId':'173OvEpu6bqDcWHVrsqFyYCo1Gn6hVc0dF7bc_OLa2K4','eventId':'diagnostic-'+uuid.uuid4().hex,'correlation':code,'email':address},separators=(',',':'))
 stamp=str(int(time.time()));digest=hashlib.sha256(body.encode()).hexdigest()
 signature=hmac.new(secret.encode(),(stamp+'\n'+digest).encode(),hashlib.sha256).hexdigest()
 return requests.post(origin+'/forms/verified',data=body,headers={'Content-Type':'application/json','X-Frost-Time':stamp,'X-Frost-Signature':signature,'X-Amz-Content-Sha256':digest},timeout=20)
assert submit('wrong@example.com').status_code==400
r=session.get(origin+'/api/register/status',timeout=20)
assert r.json()=={'status':'pending','errorCode':'EMAIL_MISMATCH'}, ('mismatch',r.status_code)
print('PASS: wrong email rejected; poll displays mismatch')
assert submit(email).status_code==200
r=session.get(origin+'/api/register/status',timeout=20)
assert r.json()=={'status':'needs_username'}, ('recovery',r.status_code)
print('PASS: correct resubmission clears mismatch and advances to username')
assert requests.get(origin+'/api/register/status',timeout=20).status_code==401
print('PASS: anonymous poll denied; no account created')
