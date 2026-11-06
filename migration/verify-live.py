"""Public route checks; never sends credentials or displays user data."""
import urllib.request,urllib.error,json,concurrent.futures,sys,time
browser=['dzj1ekbarcx0o', 'd2b2en1f5n1ip8', 'd26px1bdn6ok88', 'd243slrq91u1yp', 'ddljnl6sf6jw', 'd2pgpskmy7s0xp', 'dyw6wzlmu4nak', 'dtqrrbb6im2l7', 'do5pdsjmx5p0z', 'd2qw76gdla7rs4', 'd1kkroxfqq5ljl', 'dekfpqxiknhql', 'dc9n2hov9l11z', 'd3r48xaz4kvf9w', 'dwfnlkpnmb2n']
routes=[(host,'/health') for host in browser]+[('d2bvqh2y4lapn8','/'),('d3mbml114oiqni','/'),('d3mwcpxtmhbydi','/'),('d2ftxdtd3x015d','/')]
paused='--paused' in sys.argv
def check(item):
    host,path=item
    try:
        with urllib.request.urlopen('https://'+host+'.cloudfront.net'+path+'?migrationcheck='+str(int(time.time())),timeout=20) as r:status=r.status;body=r.read()
    except urllib.error.HTTPError as e:status=e.code;body=e.read()
    assert status==(503 if paused else 200),host+': unexpected HTTP '+str(status)
    if not paused and path=='/health':assert json.loads(body)['machine']=='ovh-bhs-1',host+': incorrect server'
    return host+': '+str(status)+(' maintenance' if paused else ' OK')
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
    for result in executor.map(check,routes):print(result)
print('PASS: all 19 public routes verified')
