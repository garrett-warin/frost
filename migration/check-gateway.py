"""Run on OVH before CloudFront cutover. Restores the closed gate on all exits."""
import pathlib,urllib.request,urllib.error,json
p=pathlib.Path('/opt/frost/production');gate=p/'gate'/'paused'
keys=dict(line.split('=',1) for line in (p/'gateway.env').read_text().splitlines())
def request(role=None,override=None,path='/'):
    headers={}
    if role:
        host={'admin':'d2ftxdtd3x015d.cloudfront.net','accounts':'d3mbml114oiqni.cloudfront.net','browser':'d18pizaz65wabf.cloudfront.net'}[role]
        headers={'X-Frost-Service':role,'X-Frost-Origin-Key':keys[role.upper()+'_ORIGIN_KEY'],'X-Frost-Public-Host':host}
    headers.update(override or {})
    try:
        with urllib.request.urlopen(urllib.request.Request('https://vps-273aa89f.vps.ovh.ca'+path,headers=headers),timeout=10) as response:return response.status,response.read()
    except urllib.error.HTTPError as error:return error.code,error.read()
assert gate.exists(),'Expected closed pre-cutover gate'
assert request()[0]==503
try:
    gate.unlink()
    assert request()[0]==403,'Unauthenticated origin exposed'
    assert request('browser',{'X-Frost-Service':'admin'})[0]==403,'Cross-service key accepted'
    assert request('admin',{'X-Frost-Public-Host':'evil.example'})[0]==403,'Untrusted public host accepted'
    assert request('admin')[0]==200,'Admin TLS route failed'
    status,body=request('browser',path='/health');assert status==200 and json.loads(body)['machine']=='ovh-bhs-1','Browser TLS route failed'
    print('PASS: verified HTTPS, origin authentication, service/host separation and browser routing')
finally:gate.touch()
assert request()[0]==503,'Maintenance gate not restored'
print('Production gate CLOSED again; no CloudFront origins changed')
