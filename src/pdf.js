import {PDFDocument,rgb} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {templates} from './templates.js';
export function wrapText(text,font,size,width){
 const lines=[];
 for(const paragraph of String(text).replaceAll('\t','    ').split(/\r?\n/)){
   if(!paragraph){lines.push('');continue;}
   let line='';
   for(const word of paragraph.split(/ +/)){
     if(font.widthOfTextAtSize((line?line+' ':'')+word,size)<=width){line+=(line?' ':'')+word;continue;}
     if(line){lines.push(line);line='';}
     // Quebra inclusive palavras e URLs maiores que a largura disponível.
     for(const char of word){if(line&&font.widthOfTextAtSize(line+char,size)>width){lines.push(line);line='';}line+=char;}
   }
   if(line)lines.push(line);
 }
 return lines;
}
export async function makePdf(snapshot,assets){
 const doc=await PDFDocument.create();doc.registerFontkit(fontkit);
 const [regular,bold,header]=await Promise.all([doc.embedFont(assets.regular,{subset:true}),doc.embedFont(assets.bold,{subset:true}),doc.embedPng(assets.header)]);
 const t=templates[snapshot.document.kind]; if(!t)throw Error('Modelo não reconhecido.');
 const pageSize=[595.28,841.89],left=55,right=540.28,width=right-left,bottom=49;
 let page,y,pageNumber=0,freshTop=0;const trace=[];
 // Caracteres não representáveis são rejeitados, nunca descartados silenciosamente.
 const charset=new Set(regular.getCharacterSet());
 for(const sec of snapshot.sections)for(const val of Object.values(sec.values))for(const c of String(val)){if(!['\n','\r','\t'].includes(c)&&!charset.has(c.codePointAt(0))) throw Error(`O PDF não suporta o caractere “${c}”. Substitua-o no texto antes de exportar.`);}
 const draw=(text,x,baseline,size=11,font=regular)=>{page.drawText(text,{x,y:baseline,size,font,color:rgb(0,0,0)});trace.push({page:pageNumber,text,x,y:baseline,size});};
 const newPage=()=>{
   page=doc.addPage(pageSize);pageNumber++;
   page.drawImage(header,{x:28,y:706,width:540,height:126});
   y=688;
   const title=wrapText(t.title,bold,12,width);
   for(const line of title){draw(line,left,y,12,bold);y-=16;}
   y-=8;freshTop=y;
 };
 newPage();
 const box=(label,text,{signature=false,sectionTitle=false}={})=>{
   let lines=wrapText(text||'Não informado.',regular,11,width-20),first=true;
   if(signature)lines.push('','________________________________________');
   const totalHeight=wrapText(label,bold,11,width-20).length*14+lines.length*14+21;
   if(totalHeight<=freshTop-bottom&&totalHeight>y-bottom)newPage();
   while(lines.length){
     const heading=wrapText(label+(first?'':' (continuação)'),bold,11,width-20);
     const headingHeight=heading.length*14;
     if(y-bottom<headingHeight+55)newPage();
     const capacity=Math.max(1,Math.floor((y-bottom-headingHeight-23)/14));
     const chunk=lines.splice(0,capacity);
     const h=headingHeight+chunk.length*14+21;
     page.drawRectangle({x:left,y:y-h,width,height:h,borderWidth:0.75,borderColor:rgb(0,0,0)});
     let pos=y-15;for(const line of heading){draw(line,left+10,pos,11,bold);pos-=14;}
     pos-=5;for(const line of chunk){draw(line,left+10,pos);pos-=14;}
     y-=h+10;first=false;
     if(lines.length)newPage();
   }
 };
 const groupedBox=(section,sec)=>{
   let lines=[];
   for(const field of section.fields){
     let value=sec.values[field.id]||'Não informado.';
     if(field.type==='date'&&/^\d{4}-\d{2}-\d{2}$/.test(value))value=value.split('-').reverse().join('/');
     if(field.type==='multiselect'){
       lines.push(...wrapText(field.label+':',regular,11,width-20));
       for(const option of field.options)lines.push(...wrapText(`${(sec.values[field.id]||'').split('\n').includes(option)?'[X]':'[  ]'} ${option}`,regular,11,width-20));
     }else{
       lines.push(...wrapText(field.label+': '+value,regular,11,width-20));
       if(field.type==='signature')lines.push('','________________________________________','');
     }
   }
   let first=true;
   while(lines.length){
     if(y-bottom<70)newPage();
     let extra=first?0:20;
     const n=Math.max(1,Math.floor((y-bottom-22-extra)/14));
     const chunk=lines.splice(0,n),h=chunk.length*14+22+extra;
     page.drawRectangle({x:left,y:y-h,width,height:h,borderWidth:.75,borderColor:rgb(0,0,0)});
     let pos=y-17;
     if(!first){draw(section.title+' (continuação)',left+10,pos,10,bold);pos-=20;}
     for(const line of chunk){draw(line,left+10,pos);pos-=14;}
     y-=h+22;first=false;if(lines.length)newPage();
   }
 };
 for(const section of t.sections){
   const sec=snapshot.sections.find(x=>x.key===section.id);
   if(!sec)throw Error('Faltam áreas do documento para gerar o PDF.');
   // Títulos de organização da tela não alteram as perguntas do modelo impresso.
   if(section.id==='assinaturas'){
     const needed=section.fields.reduce((n,f)=>n+wrapText(f.label+': '+(sec.values[f.id]||'Não informado.'),regular,11,width-20).length+3,0)*14+60;
     if(needed<=freshTop-bottom&&needed>y-bottom)newPage();
   }
   const showHeading=['estudo','paee'].includes(snapshot.document.kind)||section.id==='assinaturas'||section.id==='acolhimento';
   if(showHeading){
     const head=wrapText(section.title,bold,11,width);
     if(y-bottom<head.length*15+75)newPage();
     for(const line of head){draw(line,left,y,11,bold);y-=15;}y-=8;
   }
   if(['identificacao','assinaturas'].includes(section.id)){groupedBox(section,sec);continue;}
   for(const field of section.fields){
     let value=sec.values[field.id]||'';
     if(field.type==='date'&&/^\d{4}-\d{2}-\d{2}$/.test(value)) value=value.split('-').reverse().join('/');
     if(field.type==='multiselect')value=field.options.map(o=>`${value.split('\n').includes(o)?'[X]':'[  ]'} ${o}`).join('\n');
     box(field.label,value,{signature:field.type==='signature'});
   }
   y-=9;
 }
 for(const [i,p] of doc.getPages().entries()){
   const state=snapshot.document.status==='final'?`Edição ${snapshot.edition||1}`:'RASCUNHO — revisão pendente';
   p.drawText(`${state} • ${snapshot.document.year}${snapshot.document.term?' • '+snapshot.document.term+'º bimestre':''}`,{x:left,y:26,size:8,font:regular});
   p.drawText(`${i+1} / ${doc.getPageCount()}`,{x:right-40,y:26,size:8,font:regular});
 }
 doc.setTitle(`${t.name} — ${snapshot.student.name}`);doc.setAuthor('E.E. Luigi Pirandello');
 return {bytes:await doc.save(),trace,pages:doc.getPageCount()};
}
let assetCache;
export async function downloadPdf(snapshot){
 assetCache ||= Promise.all(['fonte-regular.ttf','fonte-negrito.ttf','cabecalho-original.png'].map(async n=>{const r=await fetch(new URL(`./assets/${n}`,import.meta.url));if(!r.ok)throw Error('Não foi possível carregar o cabeçalho ou a fonte.');return new Uint8Array(await r.arrayBuffer());})).then(([regular,bold,header])=>({regular,bold,header})).catch(e=>{assetCache=null;throw e;});
 const {bytes}=await makePdf(snapshot,await assetCache);
 const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
 const a=document.createElement('a');a.href=url;a.download=`${snapshot.document.kind}-${snapshot.document.year}-${snapshot.student.name.replace(/[^\p{L}\p{N}-]/gu,'_')}.pdf`;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
