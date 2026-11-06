import pathlib,json
p=pathlib.Path('/opt/frost/production/browser')
server=p/'server.mjs'; text=server.read_text(encoding='utf-8')
assert 'Canada - Beauharnois' in text
notice=p/'public'/'migration-notice.json'; data=json.loads(notice.read_text(encoding='utf-8'));data['enabled']=False
notice.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Migration popup withdrawn and server label normalized')
