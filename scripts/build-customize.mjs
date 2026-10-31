import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
await build({entryPoints:['public/customize/editor.mjs'],outfile:'public/customize/editor.bundle.mjs',bundle:true,minify:true,format:'esm',platform:'browser',target:'es2022',legalComments:'linked'});
const bytes=await readFile('public/customize/editor.bundle.mjs');
console.log(`Customize: ${bytes.length} bytes; ${gzipSync(bytes).length} gzip bytes (editor only).`);
await writeFile('public/customize/interact-LICENSE.txt',await readFile('node_modules/interactjs/LICENSE'));
