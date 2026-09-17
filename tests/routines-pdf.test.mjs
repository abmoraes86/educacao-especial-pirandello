import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {makeRoutinePdf} from '../src/routines-pdf.js';
test('PDF de rotina preserva textos longos e pagina dentro das margens',async()=>{
 const [regular,bold,header]=await Promise.all(['fonte-regular.ttf','fonte-negrito.ttf','cabecalho-original.png'].map(n=>readFile(`public/assets/${n}`)));
 const content={notes:'Atividades práticas em pequenos grupos.',difficulties:'Acompanhar a compreensão das orientações.',absences:'Sem registros neste exemplo.'};
 for(let d=0;d<5;d++){content[`d${d}_reading`]='O menino e o mundo';content[`d${d}_author`]='Autoria de exemplo';content[`d${d}_genre`]='Conto';for(let s=0;s<6;s++){content[`d${d}_s${s}_subject`]=s%2?'Matemática':'Língua Portuguesa';content[`d${d}_s${s}_content`]='Conteúdo: leitura e interpretação.\nObjetivos: identificar ideias centrais.\nHabilidades: EF01LP01.\nMetodologia: leitura compartilhada e registro no caderno.';}}
 const data={teacher:{name:'Professor de exemplo',class_name:'1º A',year:2026},week:'2026-09-14',slots:['07:00 às 07:50','07:50 às 08:40','08:55 às 09:45','09:45 às 10:35','10:35 às 11:25','11:25 às 12:15'],content,status:'changes',comments:[{created_at:'2026-09-17T12:00:00Z',status:'changes',version:1,body:'Na terça-feira, detalhar a estratégia de leitura.'}]};
 const sample=await makeRoutinePdf(data,{regular,bold,header});
 assert.ok(sample.pages>=2);assert.ok(sample.trace.every(t=>t.y>=37&&t.y<=480));
 const long=await makeRoutinePdf({...data,content:{...content,d0_s0_content:('PalavraMuitoLonga'.repeat(25)+'\n').repeat(18)+'MARCADOR_FINAL'}},{regular,bold,header});
 assert.ok(long.pages>sample.pages);assert.ok(long.trace.some(t=>t.text.includes('MARCADOR_FINAL')));assert.ok(long.trace.every(t=>t.y>=37&&t.y<=480));
 await mkdir('tmp/pdfs',{recursive:true});await writeFile('tmp/pdfs/rotina-exemplo.pdf',sample.bytes);await writeFile('tmp/pdfs/rotina-longa.pdf',long.bytes);
});
