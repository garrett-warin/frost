import {spawnSync} from 'node:child_process';
import {mkdir,copyFile,cp,readFile,writeFile,access} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const destination=resolve('.project-memory/ovh-release');
try{await access(destination);throw Error('Move the existing .project-memory/ovh-release aside before building a fresh release.');}catch(error){if(error.code!=='ENOENT')throw error;}
function run(command,args){const result=spawnSync(command,args,{stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)throw Error(command+' failed with '+result.status);}
run(process.execPath,['scripts/build.mjs']);
run(process.execPath,['scripts/build-admin.mjs']);
run(process.execPath,['scripts/build-platform.mjs']);
run(process.execPath,['scripts/package-source.mjs']);
await mkdir(join(destination,'app'),{recursive:true});await mkdir(join(destination,'browser'),{recursive:true});
run(process.env.PYTHON||'python',['migration/build-source-update.py',join(destination,'app')]);
for(const name of ['postgres.mjs','bridge.mjs','run.mjs','http-adapter.mjs','smoke.mjs','package.json','package-lock.json'])await copyFile('migration/'+name,join(destination,'app',name));
for(const name of ['server.mjs','account-access.mjs','device-access.mjs','relay-policy.mjs','presence.mjs','assistant.mjs','package.json','package-lock.json'])await copyFile(name,join(destination,'browser',name));
await copyFile('migration/browser-entry.mjs',join(destination,'browser/browser-entry.mjs'));
await cp('public',join(destination,'browser/public'),{recursive:true});
await mkdir(join(destination,'browser/platform'),{recursive:true});
for(const name of ['internal.mjs','security.mjs'])await copyFile('platform/'+name,join(destination,'browser/platform',name));
const hashes={};for(const role of ['accounts','admin'])hashes[role]=createHash('sha256').update(await readFile(join(destination,'app',role+'.mjs'))).digest('hex');
await writeFile(join(destination,'release.json'),JSON.stringify({builtAt:new Date().toISOString(),hashes},null,2));
console.log('OVH code assembled at '+destination+'. No server changes made. Preserve production env, gateway, database and dependencies; follow docs/DEPLOYMENT.md.');
