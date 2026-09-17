import {PDFDocument,rgb} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {wrapText} from './pdf.js';
export async function makeRoutinePdf(data,assets){
 const doc=await PDFDocument.create();doc.registerFontkit(fontkit);
 const font=await doc.embedFont(assets.regular,{subset:true}),bold=await doc.embedFont(assets.bold,{subset:true}),header=await doc.embedPng(assets.header);
 const charset=new Set(font.getCharacterSet());
 const clean=v=>String(v??'').replace(/\r/g,'').replace(/\t/g,'    ');
 const textValues=[data.teacher.name,data.teacher.class_name,...data.slots,...Object.values(data.content),...data.comments.map(c=>c.body)];
 for(const value of textValues)for(const c of clean(value))if(c!=='\n'&&!charset.has(c.codePointAt(0)))throw Error(`O PDF não suporta o caractere “${c}”. Substitua-o antes de exportar.`);
 const date=v=>v.split('-').reverse().join('/');
 const status={draft:'Rascunho',submitted:'Enviada',changes:'Ajustes solicitados',approved:'Aprovada'};
 const days=['Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira'];
 const widths=[84,140,140,140,140,140],left=29,bottom=37,lineHeight=12,size=9;
 let page,y;const trace=[];
 function draw(text,x,yy,f=font,sz=size){page.drawText(text,{x,y:yy,font:f,size:sz,color:rgb(.09,.16,.21)});trace.push({page:doc.getPageCount(),text,x,y:yy});}
 function newPage(){page=doc.addPage([841.89,595.28]);page.drawImage(header,{x:210,y:493,width:422,height:98.5});y=480;
  for(const l of wrapText(`Rotina semanal · ${data.teacher.name} · ${data.teacher.class_name}`,bold,12,780)){draw(l,left,y,bold,12);y-=15;}
  draw(`Semana de ${date(data.week)} · ${data.teacher.year} · ${status[data.status]}`,left,y);y-=20;
 }
 function row(cells,heading=false){
  const lines=cells.map((t,i)=>wrapText(clean(t)||'—',heading?bold:font,size,widths[i]-12));let continuation=false;
  while(lines.some(l=>l.length)){
   if(y-bottom<40){newPage();if(!heading)row(['Horário',...days],true);}
   const capacity=Math.max(1,Math.floor((y-bottom-14)/lineHeight));
   const n=Math.min(capacity,Math.max(...lines.map(l=>l.length))),h=n*lineHeight+14;let x=left;
   for(let i=0;i<cells.length;i++){
    page.drawRectangle({x,y:y-h,width:widths[i],height:h,borderColor:rgb(.65,.7,.74),borderWidth:.5,...(heading?{color:rgb(.93,.95,.96)}:{})});
    const chunk=lines[i].splice(0,n);chunk.forEach((l,j)=>draw(l,x+6,y-13-j*lineHeight,heading?bold:font));x+=widths[i];
   }
   y-=h;
   if(lines.some(l=>l.length)){newPage();row(['Continuação',...days],true);continuation=true;}
  }
 }
 newPage();row(['Horário',...days],true);
 row(['Leitura inicial',...days.map((_,d)=>['Leitura: '+(data.content[`d${d}_reading`]||''),'Autor: '+(data.content[`d${d}_author`]||''),'Gênero: '+(data.content[`d${d}_genre`]||'')].join('\n'))]);
 data.slots.forEach((s,i)=>row([`${i+1}ª aula\n${s}`,...days.map((_,d)=>(data.content[`d${d}_s${i}_subject`]||'Disciplina não informada')+'\n\n'+(data.content[`d${d}_s${i}_content`]||''))]));
 function paragraph(label,value){const lines=wrapText(`${label}\n${clean(value)||'Não informado.'}`,font,10,768);y-=18;for(const line of lines){if(y<bottom+14)newPage();draw(line,left+6,y,font,10);y-=14;}}
 paragraph('Observações das atividades',data.content.notes);paragraph('Estudantes com dificuldades de aprendizagem',data.content.difficulties);paragraph('Estudantes faltosos da semana',data.content.absences);
 if(data.comments.length)paragraph('Devolutivas da coordenação',data.comments.map(c=>`${new Date(c.created_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})} · ${status[c.status]} · versão ${c.version}\n${c.body}`).join('\n\n'));
 doc.getPages().forEach((p,i)=>p.drawText(`E.E. Luigi Pirandello · ${i+1} / ${doc.getPageCount()}`,{x:left,y:18,font,size:8}));
 doc.setTitle(`Rotina de ${data.teacher.name} - ${data.week}`);
 return {bytes:await doc.save(),trace,pages:doc.getPageCount()};
}
let assetsPromise;
export async function downloadRoutinePdf(data){
 assetsPromise ||= Promise.all(['fonte-regular.ttf','fonte-negrito.ttf','cabecalho-original.png'].map(async name=>{const r=await fetch(new URL(`../assets/${name}`,import.meta.url));if(!r.ok)throw Error('Não foi possível carregar os arquivos do PDF.');return new Uint8Array(await r.arrayBuffer());})).then(([regular,bold,header])=>({regular,bold,header})).catch(e=>{assetsPromise=null;throw e;});
 const {bytes}=await makeRoutinePdf(data,await assetsPromise),url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
 const a=document.createElement('a');a.href=url;a.download=`rotina-${data.week}-${data.teacher.name.replace(/[^\p{L}\p{N}-]/gu,'_')}.pdf`;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
