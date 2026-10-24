import { readFile,writeFile } from 'node:fs/promises';
import {zipSync} from 'fflate';
const files={};
for(const [name,path] of [['lambda.zip','.project-memory/admin-deploy/lambda.zip'],['stack.json','admin/stack.json'],['deploy.sh','admin/deploy.sh']]) files[name]=new Uint8Array(await readFile(path));
await writeFile('.project-memory/frost-admin-deploy.zip',zipSync(files));
