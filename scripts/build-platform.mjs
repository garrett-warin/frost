import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {build} from 'esbuild';
import {zipSync} from 'fflate';
import {template} from './platform-template.mjs';
const assets={};
for(const [path,type] of [['/admin-notifications.mjs','text/javascript'],['/admin-notifications.css','text/css']])assets[path]={type,body:await readFile('public'+path,'utf8')};
for(const [route,file,type] of [['/terms.html','public/terms.html','text/html; charset=utf-8'],['/terms.css','public/terms.css','text/css'],['/wordmark-still.svg','public/wordmark-still.svg','image/svg+xml']])assets[route]={type,body:await readFile(file,'utf8')};
assets['/terms']=assets['/terms.html'];
assets['/username-rules']={type:'text/html; charset=utf-8',body:await readFile('platform/ui/username-rules.html','utf8')};
assets['/username-rules.css']={type:'text/css',body:await readFile('platform/ui/username-rules.css','utf8')};
assets['/maintenance-banner.mjs']={type:'text/javascript',body:await readFile('public/maintenance-banner.mjs','utf8')};
assets['/wordmark.svg']={type:'image/svg+xml',body:await readFile('public/wordmark.svg','utf8')};
for(const [route,file,type] of [['/index.html','platform/ui/index.html','text/html; charset=utf-8'],['/account.mjs','platform/ui/account.mjs','text/javascript'],['/account.css','platform/ui/account.css','text/css'],['/wordmark.svg','public/wordmark.svg','image/svg+xml'],['/icon.svg','public/icon.svg','image/svg+xml']])assets[route]={type,body:await readFile(file,'utf8')};
                                                                 
const staffHtml=(await readFile('admin/index.html','utf8')).replace('grove / developer tools','grove / account administration').replace('<main>','<main><a href="/">Back to your account</a>');
assets['/admin']={type:'text/html; charset=utf-8',body:staffHtml};
for(const [route,file,type] of [['/admin.js','admin/admin.js','text/javascript'],['/admin.css','admin/admin.css','text/css'],['/staff-session.mjs','platform/ui/staff-session.mjs','text/javascript']])assets[route]={type,body:await readFile(file,'utf8')};
await mkdir('.project-memory/platform-deploy',{recursive:true});
                                                                               
const virtualAssets={name:'platform-assets',setup(build){build.onResolve({filter:/\.\/assets\.mjs$/},args=>args.importer.endsWith('platform/handler.mjs')||args.importer.endsWith('platform\\handler.mjs')?{path:'platform-assets',namespace:'frost-assets'}:undefined);build.onLoad({filter:/.*/,namespace:'frost-assets'},()=>({contents:'export const assets='+JSON.stringify(assets)+';',loader:'js'}));}};
await build({entryPoints:['platform/handler.mjs'],outfile:'.project-memory/platform-deploy/index.mjs',bundle:true,platform:'node',format:'esm',target:'node22',external:['@aws-sdk/client-dynamodb','@aws-sdk/client-lambda'],plugins:[virtualAssets],banner:{js:"import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);"}});
await writeFile('.project-memory/platform-deploy/lambda.zip',zipSync({'index.mjs':new Uint8Array(await readFile('.project-memory/platform-deploy/index.mjs'))}));
const deployment={'lambda.zip':new Uint8Array(await readFile('.project-memory/platform-deploy/lambda.zip')),'stack.json':new TextEncoder().encode(JSON.stringify(template,null,2))};
for(const file of ['deploy.sh','deploy.py'])deployment[file]=new Uint8Array(await readFile('platform/'+file));
await writeFile('.project-memory/platform-deploy/deployment.zip',zipSync(deployment));
console.log('Built isolated account Lambda package. Deployment and Google setup remain required.');
