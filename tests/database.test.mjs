import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {templates,initialValues} from '../src/templates.js';
const uid='00000000-0000-4000-a000-000000000001',other='00000000-0000-4000-a000-000000000002';
const secret='a'.repeat(64),second='b'.repeat(64);
let db;
async function as(role,id=''){await db.exec(`reset role; select set_config('request.jwt.claim.sub','${id}',false); set role ${role};`);}
async function admin(action,data={}){return (await db.query('select public.ee_admin($1,$2::jsonb) as result',[action,JSON.stringify(data)])).rows[0].result;}
async function open(token=secret){return (await db.query('select public.ee_open_invite($1) as result',[token])).rows[0].result;}
async function save(id,key,values,version,token=null){return (await db.query('select public.ee_save_section($1,$2,$3::jsonb,$4,$5) as result',[id,key,JSON.stringify(values),version,token])).rows[0].result;}
test('Autorização e ciclo completo dos documentos em PostgreSQL local',async t=>{
 db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); insert into auth.users values ('${uid}'),('${other}'); create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
 await db.exec(await readFile('supabase/migrations/001_escola.sql','utf8'));
 await db.exec(await readFile('supabase/migrations/002_modelos.sql','utf8'));
 await db.exec(`insert into ee_private.administrator(user_id) values('${uid}')`);
 await t.test('anon não lista dados nem acessa tabelas ou funções internas',async()=>{
   await as('anon');await assert.rejects(()=>admin('list'),/permission denied/);
   await assert.rejects(()=>db.query('select * from ee_private.students'),/permission denied/);
   await assert.rejects(()=>db.query('select ee_private.snapshot(null)'),/permission denied/);
 });
 await t.test('usuário autenticado comum não obtém acesso de gestão',async()=>{await as('authenticated',other);await assert.rejects(()=>admin('list'),/exclusivo/);});
 await as('authenticated',uid);
 const student=await admin('create_student',{name:'Estudante de teste',grade:'6º A'});
 let doc;
 await t.test('admin cria os cinco modelos com campos validados',async()=>{
   for(const [kind,tpl] of Object.entries(templates)){
     const term=['pei','retorno'].includes(kind)?1:0,subject=kind==='pei'?'Português':'';
     const created=await admin('create_document',{student_id:student.id,kind,year:2026,term,subject,initial:initialValues(kind,student,term,subject)});
     assert.equal(created.sections.length,tpl.sections.length);if(kind==='pei')doc=created;
   }
   assert.equal((await admin('list')).documents.length,5);
   await assert.rejects(()=>admin('create_document',{student_id:student.id,kind:'pei',year:2026,term:0,subject:''}),/check constraint/);
 });
 const id=doc.document.id;
 await admin('create_invite',{id,label:'Docente convidado',token:secret,scopes:['curriculo'],expires_at:new Date(Date.now()+3600000).toISOString()});
 await t.test('convite lê apenas suas áreas e identidade mínima',async()=>{
   await as('anon');const c=await open();assert.equal(c.sections.length,1);assert.equal(c.sections[0].key,'curriculo');assert.deepEqual(Object.keys(c.student).sort(),['grade','name']);assert.ok(!JSON.stringify(c).includes('token_hash'));
   await assert.rejects(()=>open('0'.repeat(64)),/inválido/);
   await assert.rejects(()=>save(id,'identificacao',{nome:'Alterado'},0,secret),/não autorizada/);
   const another=(await db.query(`select public.ee_save_section($1,'curriculo','{}',0,$2)`,['00000000-0000-4000-a000-111111111111',secret]).catch(e=>e));assert.match(another.message,/não autorizada/);
 });
 await t.test('valida campos no servidor e detecta conflito sem sobrescrever',async()=>{
   await assert.rejects(()=>save(id,'curriculo',{admin:'true'},0,secret),/Campo inválido/);
   await assert.rejects(()=>save(id,'curriculo',{relato:'x'.repeat(20001)},0,secret),/20.000/);
   const saved=await save(id,'curriculo',{relato:'Objetivos de aprendizagem.'},0,secret);assert.equal(saved.version,1);
   await assert.rejects(()=>save(id,'curriculo',{relato:'Sobrescrita'},0,secret),/CONFLICT/);
   assert.equal((await open()).sections[0].values.relato,'Objetivos de aprendizagem.');
 });
 await t.test('envio fecha área e rejeita versão antiga',async()=>{
   await assert.rejects(()=>db.query('select public.ee_submit_invite($1,$2)',[secret,{curriculo:0}]),/CONFLICT/);
   await db.query('select public.ee_submit_invite($1,$2)',[secret,{curriculo:1}]);
   assert.equal((await open()).sections[0].status,'submitted');
   await assert.rejects(()=>save(id,'curriculo',{relato:'Depois do envio'},2,secret),/reabertura/);
 });
 await t.test('admin devolve área, acompanha histórico e restaura revisão',async()=>{
   await as('authenticated',uid);
   await admin('review',{id,key:'curriculo',version:2,status:'draft',feedback:'Detalhar.'});
   const history=await admin('history',{id,key:'curriculo'});assert.equal(history.length,4);
   await admin('restore',{id,key:'curriculo',version:3,revision_id:history.find(r=>r.version===1).id});
   const c=await admin('get',{id});assert.equal(c.sections.find(s=>s.key==='curriculo').version,4);assert.equal(c.sections.find(s=>s.key==='curriculo').feedback,'Detalhar.');
 });
 await t.test('convites expirados e revogados não leem nem escrevem',async()=>{
   await admin('create_invite',{id,label:'Segundo',token:second,scopes:['estrategias'],expires_at:new Date(Date.now()+3600000).toISOString()});
   const c=await admin('get',{id});const invitation=c.invitations.find(i=>i.label==='Segundo');await admin('revoke_invite',{id,invitation_id:invitation.id});
   await as('anon');await assert.rejects(()=>open(second),/revogado/);await assert.rejects(()=>save(id,'estrategias',{relato:'Teste'},0,second),/revogado/);
   await as('postgres');await db.query("update ee_private.invitations set expires_at=now()-interval '1 second' where label='Docente convidado'");
   await as('anon');await assert.rejects(()=>open(),/expirado/);
 });
 await t.test('finalização exige aprovação e guarda edição imutável',async()=>{
   await as('authenticated',uid);await assert.rejects(()=>admin('finalize',{id}),/aprove todas/);
   let c=await admin('get',{id});
   for(const sec of c.sections){
     const def=templates.pei.sections.find(s=>s.id===sec.key);let updated=sec;
     if(!Object.values(sec.values).some(Boolean))updated=await save(id,sec.key,{[def.fields[0].id]:'Resposta para teste.'},sec.version);
     await admin('review',{id,key:sec.key,version:updated.version,status:'approved'});
   }
   await admin('finalize',{id});c=await admin('get',{id});assert.equal(c.editions.length,1);assert.equal(c.document.status,'final');
   const edition=await admin('edition',{id,edition_id:c.editions[0].id});
   await assert.rejects(()=>save(id,'curriculo',{relato:'Mudança'},5),/indisponível/);
   await admin('reopen_document',{id});c=await admin('get',{id});const sec=c.sections.find(s=>s.key==='curriculo');await save(id,'curriculo',{relato:'Texto novo'},sec.version);
   assert.deepEqual(await admin('edition',{id,edition_id:c.editions[0].id}),edition);
 });
 await t.test('apenas um administrador pode ser cadastrado',async()=>{
   await as('postgres');await assert.rejects(()=>db.query('insert into ee_private.administrator(user_id) values($1)',[other]),/duplicate key/);
 });
 await db.close();
});
