import {fileURLToPath} from 'node:url';
import {spawnSync,execFileSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
const root=new URL('../',import.meta.url);process.chdir(fileURLToPath(root));
function run(cmd,args){const result=spawnSync(cmd,args,{stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);}
const git=args=>execFileSync('git',['-c','safe.directory='+process.cwd().replaceAll('\\','/'),...args],{encoding:'utf8'}).trim();
if(git(['status','--porcelain','--untracked-files=normal']))throw Error('Commit or move your pending changes first. Release checks require a clean checkout.');
const expected=git(['ls-tree','HEAD','upstream']).split(/\s+/)[2];
if(!expected||git(['-C','upstream','rev-parse','HEAD'])!==expected)throw Error('Initialize the pinned engine: git submodule update --init --recursive');
run(process.execPath,['scripts/build-context.mjs','--check']);
console.log('Checking release commit '+git(['rev-parse','HEAD']));
run(process.execPath,['scripts/build.mjs']);
run(process.execPath,['--test',...readdirSync('test').filter(x=>x.endsWith('.test.mjs')).map(x=>'test/'+x)]);
run(process.execPath,['scripts/build-admin.mjs']);
run(process.execPath,['scripts/build-platform.mjs']);
run(process.execPath,['scripts/package-source.mjs']);
console.log('Release checks passed. Production uses OVH; run npm run build:ovh and follow docs/DEPLOYMENT.md.');
