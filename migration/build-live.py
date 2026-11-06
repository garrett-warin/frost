"""Adapt reviewed live Lambda artifacts without rebuilding unrelated features."""
import base64, hashlib, pathlib, sys, zipfile, re
source, destination = map(pathlib.Path, sys.argv[1:3])
destination.mkdir(parents=True, exist_ok=True)
expected = {'accounts':'9m3jCGAf2IoiyD0JPsecqFzmlYddnj1HMFMYJ9VVMdM=', 'admin':'G4BsavxMvqito/EhlKYR9/qTIFEotXEUdTtnB7siXlw='}
for role in expected:
    archive = source / (role+'-live.zip')
    assert base64.b64encode(hashlib.sha256(archive.read_bytes()).digest()).decode() == expected[role], 'Live artifact changed; review before adapting'
    text = zipfile.ZipFile(archive).read('index.mjs').decode()
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
    print(role,'adapted, original zip verified')
