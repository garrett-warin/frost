"""Retire editor surfaces on existing live bundles without replacing other features."""
import boto3, requests, zipfile, io, re, subprocess, sys
from pathlib import Path
client=boto3.client('lambda')
root=Path.home()/'frost-retire-customize-20261104';root.mkdir(mode=0o700,exist_ok=True)
for role,name in [('accounts','frost-accounts-Function-qqSxuvfShn08'),('admin','frost-admin-Function-EdCFDwgOTrcP')]:
 if len(sys.argv)>1 and role not in sys.argv[1:]:continue
 info=client.get_function(FunctionName=name)
 raw=requests.get(info['Code']['Location'],timeout=30);raw.raise_for_status()
 backup=root/(role+'-before.zip')
 if backup.exists():assert backup.read_bytes()==raw.content, 'Live version changed since backup'
 else:backup.write_bytes(raw.content)
 archive=zipfile.ZipFile(io.BytesIO(raw.content));s=archive.read('index.mjs').decode()
 def once(a,b):
  global s
  assert s.count(a)==1, 'Missing or ambiguous target: '+a[:80]
  s=s.replace(a,b,1)
 if role=='accounts':
  marker='requireThat(["GET", "POST"].includes(method), 405, "Method not allowed.");'
  once(marker,'if (/^\\/(?:customize(?:\\/|$)|template-preview\\.mjs$|api\\/(?:design$|templates(?:\\/|$)|admin\\/templates(?:\\/|$))|internal\\/design$)/.test(path)) return response(410, {error:"New-tab customization has been removed."});\n    '+marker)
  marker='const { action, body = {} } = event;'
  once(marker,marker+'\n    if (String(action).startsWith("templates-")) return {statusCode:410,data:{error:"New-tab customization has been removed."}};')
  link='<a href=\\"/customize\\">Customize new tab</a>'
  plain='<a href="/customize">Customize new tab</a>'
  assert link in s or plain in s;s=s.replace(link,'').replace(plain,'')
 else:
  marker='if (method === "GET" && Object.hasOwn(assets2, path))'
  once(marker,'if (/^\\/(?:customize(?:\\/|$)|template-preview\\.mjs$|templates(?:\\/|$))/.test(path)) return reply(410,{error:"New-tab customization has been removed."});\n    '+marker)
 s=re.sub(r'<button data-view=\\"templates\\">Templates</button>','',s)
 s=re.sub(r'<section data-panel=\\"templates\\".*?</section>','',s)
 s=re.sub(r'<button data-view="templates">Templates</button>','',s)
 s=re.sub(r'<section data-panel="templates".*?</section>','',s)
 s=s.replace("if(button.dataset.view==='templates')await templates();",'')
 s=s.replace("$('template-results').replaceChildren();$('template-reports').replaceChildren();",'')
 start=s.find('let templateCursor=null,templateReportCursor=null;')
 finish="$('more-template-reports').onclick=()=>void run(()=>templateReports(templateReportCursor));"
 assert start>=0 and finish in s
 end=s.index(finish,start)+len(finish);s=s[:start]+s[end:]
 target=root/(role+'.mjs');target.write_text(s)
 subprocess.run(['node','--check',str(target)],check=True)
 out=io.BytesIO()
 with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
  for entry in archive.namelist():z.writestr(entry,s.encode() if entry=='index.mjs' else archive.read(entry))
 client.update_function_code(FunctionName=name,ZipFile=out.getvalue(),RevisionId=info['Configuration']['RevisionId'])
 client.get_waiter('function_updated').wait(FunctionName=name)
 print(role+': retired customization, backup saved, deployment successful',flush=True)
