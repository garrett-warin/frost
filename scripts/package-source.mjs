import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { zipSync } from 'fflate';
const root=fileURLToPath(new URL('../',import.meta.url));
const entries={};
function tracked(cwd){return execFileSync('git',['-c',`safe.directory=${cwd.replaceAll('\\','/')}`,'ls-files','--stage','-z'],{cwd,encoding:'utf8'}).split('\0').filter(Boolean).flatMap(row=>{const [meta,path]=row.split('\t');return /^(100644|100755) /.test(meta)?[path]:[];});}
function permitted(path){return !path.split('/').some(part=>part==='.git'||part==='.project-memory'||part==='node_modules'||part==='source.zip'||part==='.aws'||(part.startsWith('.env')&&part!=='.env.example')||/\.(pem|key|log)$/i.test(part));}
for(const file of tracked(root))if(permitted(file)&&!file.startsWith('upstream/'))entries['frost/'+file]=new Uint8Array(await readFile(join(root,file)));
                                                                              
for(const file of tracked(join(root,'upstream')))if(permitted(file))entries['frost/upstream/'+file]=new Uint8Array(await readFile(join(root,'upstream',file)));
await writeFile(join(root,'public/source.zip'),zipSync(entries,{level:6}));
console.log(`Packaged ${Object.keys(entries).length} tracked source files; untracked files and private runtime files excluded.`);
