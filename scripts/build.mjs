import {build} from 'esbuild';
import {cp,mkdir,rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
await cp('public','dist',{recursive:true});
await cp('src/style.css','dist/style.css');
await build({entryPoints:['src/app.js'],outfile:'dist/app.js',bundle:true,minify:true,format:'esm',target:['es2022'],legalComments:'external'});
console.log('Build estático gerado em dist/');
