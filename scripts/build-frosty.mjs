import {build} from 'esbuild';
await build({entryPoints:['public/frosty/markdown-source.mjs'],outfile:'public/frosty/markdown.js',bundle:true,format:'esm',minify:true,legalComments:'eof'});
