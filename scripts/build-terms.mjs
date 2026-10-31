import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const html=(await readFile(new URL('../public/terms.html',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
const version=createHash('sha256').update(html).digest('hex');
await writeFile(new URL('../platform/terms-document.mjs',import.meta.url),'// Generated from public/terms.html by scripts/build-terms.mjs.\nexport const termsVersion='+JSON.stringify(version)+';\n');
