"""Adapt newly built, tested repository account/admin bundles to OVH boundaries."""
import base64, hashlib, pathlib, sys, zipfile, re
destination = pathlib.Path(sys.argv[1])
destination.mkdir(parents=True,exist_ok=True)
manifest={}
for role,folder in [('accounts','platform-deploy'),('admin','admin-deploy')]:
    bundle=pathlib.Path('.project-memory')/folder/'index.mjs'
    text=bundle.read_text(encoding='utf-8')
    manifest[role+'SourceSha256']=hashlib.sha256(bundle.read_bytes()).hexdigest()
    text = re.sub(r'^import .* from "@aws-sdk/client-(?:dynamodb|lambda)";\r?\n', '', text, flags=re.M)
    def replace_range(start,end,replacement):
        global text
        assert text.count(start)==1 and text.count(end)==1, 'Unexpected live bundle boundary'
        a,b=text.index(start),text.index(end)
        assert a<b
        text=text[:a]+replacement+'\n'+text[b:]
    if role=='accounts':
        assert text.count('"https://frost-browsing.fly.dev/api/presence"')==1
        text=text.replace('"https://frost-browsing.fly.dev/api/presence"','process.env.FROST_PRESENCE_ORIGIN + "/api/presence"',1)
        replace_range('function dynamoStore(table, client = new DynamoDBClient({})) {','async function atomic(store, fn) {',
                      'function dynamoStore(table) { if(!table) throw Error("Missing table identity"); return accountStore("accounts", Conflict); }')
        replace_range('var adminLambda = new LambdaClient({});','var initialized;',
                      'async function legacyAdmin(path, body) { return invokeBridge({path,body}); }')
    else:
        replace_range('var client = new DynamoDBClient({});','var service = createAdminService(',
                      'var store = adminStore("admin"); async function owner(action, body={}) { return invokeBridge({action,body}); }')
    text='import {accountStore,adminStore} from "./postgres.mjs";\nimport {invokeBridge} from "./bridge.mjs";\n'+text
    assert '@aws-sdk/' not in text
    (destination/(role+'.mjs')).write_text(text,encoding='utf-8')
    manifest[role+'Sha256']=hashlib.sha256((destination/(role+'.mjs')).read_bytes()).hexdigest()
    print(role,'source bundle adapted')

import json
(destination/"manifest.json").write_text(json.dumps(manifest,indent=2))
