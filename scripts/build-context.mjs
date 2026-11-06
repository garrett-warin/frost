import {execFileSync} from 'node:child_process';
import {writeFileSync,readFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const tracked=directory=>execFileSync('git',['-c',`safe.directory=${directory.replaceAll('\\','/')}`,'ls-files','--stage','-z'],{cwd:directory,encoding:'utf8'}).split('\0').filter(Boolean).flatMap(row=>/^(100644|100755) /.test(row)?[row.split('\t')[1]]:[]);
const files=[...tracked(root),...tracked(root+'upstream').map(p=>'upstream/'+p)].filter(p=>!p.split('/').some(n=>n.startsWith('.env')||['.git','.project-memory','node_modules','source.zip'].includes(n)||/\.(key|pem|log)$/i.test(n)));
const dirs=new Set();for(const file of files){let dir=dirname(file).replaceAll('\\','/');while(dir!=='.'){dirs.add(dir);dir=dirname(dir).replaceAll('\\','/');}}
                                                                               
                                                                             
const lines=['**'];
for(const dir of [...dirs].sort((a,b)=>a.split('/').length-b.split('/').length||a.localeCompare(b)))lines.push('!'+dir+'/',dir+'/**');
for(const file of files.sort())lines.push('!'+file);
const output=lines.join('\n')+'\n',path=root+'.dockerignore';
if(process.argv.includes('--check')){if(readFileSync(path,'utf8').replace(/\r\n/g,'\n')!==output)throw Error('Build context is stale. Stage new source files, run npm run sync:context, and commit the result.');}
else writeFileSync(path,output);
