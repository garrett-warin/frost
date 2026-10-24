import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { build } from 'esbuild';
import { zipSync } from 'fflate';
const assets={};
for(const [route,file,type] of [['/','index.html','text/html; charset=utf-8'],['/admin.js','admin.js','text/javascript'],['/admin.css','admin.css','text/css']])assets[route]={body:await readFile('admin/'+file,'utf8'),type};
await writeFile('admin/assets.mjs','export const assets='+JSON.stringify(assets)+';');
await mkdir('.project-memory/admin-deploy',{recursive:true});
await build({entryPoints:['admin/handler.mjs'],outfile:'.project-memory/admin-deploy/index.mjs',bundle:true,platform:'node',format:'esm',target:'node22',external:['@aws-sdk/client-dynamodb'],banner:{js:"import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);"}});
await writeFile('.project-memory/admin-deploy/lambda.zip',zipSync({'index.mjs':new Uint8Array(await readFile('.project-memory/admin-deploy/index.mjs'))}));
