import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {makePdf} from '../src/pdf.js';
import {templates,initialValues} from '../src/templates.js';
const assets=Object.fromEntries(await Promise.all([['regular','fonte-regular.ttf'],['bold','fonte-negrito.ttf'],['header','cabecalho-original.png']].map(async([key,file])=>[key,new Uint8Array(await readFile('public/assets/'+file))])));
function example(kind,long=false){
 const student={name:'Estudante de demonstração',grade:'6º ano A',birth_date:'2014-03-14'};
 const initial=initialValues(kind,student,1,'Língua Portuguesa');
 return {student,document:{kind,year:2026,term:['pei','retorno'].includes(kind)?1:0,subject:kind==='pei'?'Língua Portuguesa':'',status:'draft'},sections:templates[kind].sections.map(section=>({key:section.id,values:Object.fromEntries(section.fields.map(f=>[f.id,initial[section.id][f.id]||(f.type==='date'?'2026-09-11':f.type==='select'?f.options[0]:f.type==='multiselect'?f.options.slice(0,2).join('\n'):f.type==='signature'?'Nome para demonstração':f.type==='textarea'?(long?Array.from({length:100},(_,i)=>`Registro ${i+1}: resposta de teste com observações pedagógicas, participação e estratégias de aprendizagem. FIM${i+1}`).join('\n'):'Resposta de demonstração. Substituir pelas observações da equipe escolar.'):'Demonstração')]))}))};
}
test('PDF dos cinco modelos mantém texto dentro dos limites da página',async()=>{
 await mkdir('qa-output',{recursive:true});
 for(const kind of Object.keys(templates)){
   const result=await makePdf(example(kind),assets);
   assert.ok(result.pages>0);
   assert.ok(result.trace.every(line=>line.y>=49&&line.y<=688),`${kind}: texto fora da área`);
   for(const section of templates[kind].sections)for(const field of section.fields)assert.ok(result.trace.some(line=>field.label.startsWith(line.text)||line.text.startsWith(field.label)),`Campo ausente: ${field.label}`);
   await writeFile(`qa-output/${kind}-demonstracao.pdf`,result.bytes);
 }
});
test('resposta longa preserva cada registro e gera continuação',async()=>{
 const snap=example('pei');snap.sections.find(s=>s.key==='curriculo').values.relato=Array.from({length:100},(_,i)=>`REGISTRO${i+1} — Aprendizagem, participação e comunicação. FINAL${i+1}`).join('\n');
 const result=await makePdf(snap,assets),all=result.trace.map(l=>l.text).join('\n');
 assert.ok(result.pages>=3);assert.match(all,/continuação/);
 for(let i=1;i<=100;i++)assert.ok(all.includes(`FINAL${i}`));
 assert.ok(result.trace.every(l=>l.y>=49&&l.y<=688));
 await writeFile('qa-output/pei-texto-longo.pdf',result.bytes);
});
test('caractere não suportado é informado, sem descarte silencioso',async()=>{
 const snap=example('pei');snap.sections[1].values.relato='Teste 😀';await assert.rejects(()=>makePdf(snap,assets),/não suporta/);
});
