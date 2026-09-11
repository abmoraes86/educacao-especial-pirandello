-- Instalação inicial: execute uma vez no projeto indicado. Sem dados de estudantes.
begin;
create schema if not exists ee_private;
revoke all on schema ee_private from public, anon, authenticated;
create table ee_private.administrator (
 singleton boolean primary key default true check(singleton),
 user_id uuid not null unique references auth.users(id), created_at timestamptz not null default now()
);
create table ee_private.templates (kind text primary key, definition jsonb not null);
create table ee_private.students (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 200),
 grade text not null check(length(grade) between 1 and 100), birth_date date,
 created_at timestamptz not null default now()
);
create table ee_private.documents (
 id uuid primary key default gen_random_uuid(), student_id uuid not null references ee_private.students(id),
 kind text not null references ee_private.templates(kind), year int not null check(year between 2020 and 2100),
 term int not null default 0 check(term between 0 and 4), subject text not null default '' check(length(subject)<=150),
 due_date date, status text not null default 'draft' check(status in ('draft','final')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(student_id,kind,year,term,subject),
 check((kind='pei' and term between 1 and 4 and length(trim(subject))>0) or (kind='retorno' and term between 1 and 4 and subject='') or (kind in ('estudo','paee','acolhimento') and term=0 and subject=''))
);
create table ee_private.sections (
 document_id uuid not null references ee_private.documents(id), key text not null, values jsonb not null default '{}',
 version int not null default 0, status text not null default 'draft' check(status in ('draft','submitted','approved')),
 feedback text not null default '', updated_at timestamptz not null default now(),
 primary key(document_id,key)
);
create table ee_private.invitations (
 id uuid primary key default gen_random_uuid(), document_id uuid not null references ee_private.documents(id),
 token_hash bytea not null unique, label text not null check(length(label) between 1 and 150),
 scopes text[] not null check(cardinality(scopes)>0), expires_at timestamptz not null, revoked_at timestamptz,
 created_at timestamptz not null default now()
);
create index invitations_document_idx on ee_private.invitations(document_id);
create table ee_private.revisions (
 id bigint generated always as identity primary key, document_id uuid not null, section_key text not null,
 version int not null, values jsonb not null, status text not null, feedback text not null,
 actor text not null, created_at timestamptz not null default now(),
 foreign key(document_id,section_key) references ee_private.sections(document_id,key),
 unique(document_id,section_key,version)
);
create table ee_private.editions (
 id uuid primary key default gen_random_uuid(), document_id uuid not null references ee_private.documents(id),
 edition int not null, snapshot jsonb not null, created_at timestamptz not null default now(), unique(document_id,edition)
);
create table ee_private.audit (
 id bigint generated always as identity primary key, document_id uuid references ee_private.documents(id),
 event text not null, actor text not null, created_at timestamptz not null default now()
);
-- Área reservada para preservar configuração de uma instalação anterior, quando houver.
create table ee_private.previous_school_settings (
 id integer primary key,school_name text not null,academic_year integer not null,
 director_name text,coordinator_name text,specialized_teacher_name text,collaborative_teacher_name text,
 created_at timestamptz,updated_at timestamptz
);
create index documents_kind_idx on ee_private.documents(kind);
create index audit_document_idx on ee_private.audit(document_id);
alter table ee_private.previous_school_settings enable row level security;
-- Defesa em profundidade: nenhuma tabela é acessível pelo cliente.
alter table ee_private.administrator enable row level security;
alter table ee_private.templates enable row level security;
alter table ee_private.students enable row level security;
alter table ee_private.documents enable row level security;
alter table ee_private.sections enable row level security;
alter table ee_private.invitations enable row level security;
alter table ee_private.revisions enable row level security;
alter table ee_private.editions enable row level security;
alter table ee_private.audit enable row level security;
revoke all on all tables in schema ee_private from public, anon, authenticated;
revoke all on all sequences in schema ee_private from public, anon, authenticated;

create function ee_private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from ee_private.administrator where user_id=auth.uid());
$$;
create function ee_private.assert_values(p_kind text,p_key text,p_values jsonb) returns void language plpgsql set search_path='' as $$
declare fields jsonb; item record; def jsonb; option_text text;
begin
 select elem->'fields' into fields from ee_private.templates t, jsonb_array_elements(t.definition->'sections') elem where t.kind=p_kind and elem->>'id'=p_key;
 if fields is null or p_values is null or jsonb_typeof(p_values)<>'object' or octet_length(p_values::text)>150000 then raise exception 'Campos inválidos.'; end if;
 for item in select * from jsonb_each(p_values) loop
   select f into def from jsonb_array_elements(fields) f where f->>'id'=item.key;
   if def is null or jsonb_typeof(item.value)<>'string' or length(item.value #>> '{}')>20000 then raise exception 'Campo inválido ou texto acima de 20.000 caracteres.'; end if;
   if def->>'type'='select' and item.value #>> '{}' <> '' and not (def->'options' @> jsonb_build_array(item.value)) then raise exception 'Opção inválida.'; end if;
   if def->>'type'='multiselect' and item.value #>> '{}' <> '' then
     foreach option_text in array string_to_array(item.value #>> '{}', E'\n') loop
       if not (def->'options' @> jsonb_build_array(option_text)) then raise exception 'Opção inválida.'; end if;
     end loop;
   end if;
   if def->>'type'='date' and item.value #>> '{}' <> '' then
     if not ((item.value #>> '{}') ~ '^\d{4}-\d{2}-\d{2}$') then raise exception 'Data inválida.'; end if;
     perform (item.value #>> '{}')::date;
   end if;
 end loop;
end; $$;
create function ee_private.invite(p_token text) returns ee_private.invitations language plpgsql stable security definer set search_path='' as $$
declare i ee_private.invitations;
begin
 if p_token is null or p_token !~ '^[0-9a-f]{64}$' then raise exception 'Convite inválido, expirado ou revogado.'; end if;
 select * into i from ee_private.invitations where token_hash=sha256(convert_to(p_token,'UTF8')) and expires_at>now() and revoked_at is null;
 if i.id is null then raise exception 'Convite inválido, expirado ou revogado.'; end if;
 return i;
end; $$;
create function ee_private.snapshot(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('document',to_jsonb(d),'student',to_jsonb(s),'sections',
 coalesce((select jsonb_agg(to_jsonb(sec) order by sec.key) from ee_private.sections sec where sec.document_id=d.id),'[]'::jsonb))
 from ee_private.documents d join ee_private.students s on s.id=d.student_id where d.id=p_id;
$$;
create function ee_private.record_revision(p_id uuid,p_key text,p_actor text) returns void language plpgsql set search_path='' as $$
begin
 insert into ee_private.revisions(document_id,section_key,version,values,status,feedback,actor)
 select document_id,key,version,values,status,feedback,p_actor from ee_private.sections where document_id=p_id and key=p_key;
 update ee_private.documents set updated_at=now() where id=p_id;
end; $$;

create function ee_private.ee_open_invite(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare i ee_private.invitations; result jsonb;
begin
 i:=ee_private.invite(p_token);
 select jsonb_build_object('invitation',jsonb_build_object('label',i.label,'expires_at',i.expires_at,'scopes',i.scopes),
 'document',jsonb_build_object('id',d.id,'kind',d.kind,'year',d.year,'term',d.term,'subject',d.subject,'status',d.status,'due_date',d.due_date),
 'student',jsonb_build_object('name',s.name,'grade',s.grade),
 'sections',(select jsonb_agg(to_jsonb(sec) order by sec.key) from ee_private.sections sec where sec.document_id=d.id and sec.key=any(i.scopes))) into result
 from ee_private.documents d join ee_private.students s on s.id=d.student_id where d.id=i.document_id;
 return result;
end; $$;

create function ee_private.ee_save_section(p_document uuid,p_key text,p_values jsonb,p_version int,p_token text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare d ee_private.documents; sec ee_private.sections; i ee_private.invitations; actor text;
begin
 if ee_private.is_admin() then actor:='Administrador'; else
   i:=ee_private.invite(p_token);
   if i.document_id<>p_document or not (p_key=any(i.scopes)) then raise exception 'Área não autorizada.'; end if;
   actor:='Convite: '||i.label;
 end if;
 select * into d from ee_private.documents where id=p_document for update;
 -- Revalidar após esperar o lock: revogação e finalização têm efeito imediato.
 if i.id is not null then i:=ee_private.invite(p_token); end if;
 if d.id is null or d.status='final' then raise exception 'Documento indisponível para edição.'; end if;
 select * into sec from ee_private.sections where document_id=p_document and key=p_key for update;
 if sec.key is null or sec.status<>'draft' then raise exception 'Área enviada para revisão. Solicite reabertura ao administrador.'; end if;
 if p_version is null or sec.version<>p_version then raise exception 'CONFLICT: esta área mudou em outra sessão. Copie suas alterações antes de recarregar.'; end if;
 perform ee_private.assert_values(d.kind,p_key,p_values);
 update ee_private.sections set values=p_values,version=version+1,updated_at=now() where document_id=p_document and key=p_key returning * into sec;
 perform ee_private.record_revision(p_document,p_key,actor);
 return to_jsonb(sec);
end; $$;

create function ee_private.ee_submit_invite(p_token text,p_versions jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare i ee_private.invitations; d ee_private.documents; sec ee_private.sections;
begin
 i:=ee_private.invite(p_token);
 select * into d from ee_private.documents where id=i.document_id for update;
 i:=ee_private.invite(p_token);
 if d.status='final' then raise exception 'Documento finalizado.'; end if;
 for sec in select * from ee_private.sections where document_id=d.id and key=any(i.scopes) for update loop
   if sec.status='draft' then
     if p_versions->>sec.key is null or (p_versions->>sec.key)::int<>sec.version then raise exception 'CONFLICT: existem alterações de outra sessão. Recarregue antes de enviar.'; end if;
     if not exists(select 1 from jsonb_each_text(sec.values) e where length(trim(e.value))>0) then raise exception 'Preencha todas as áreas do convite antes de enviar.'; end if;
     update ee_private.sections set status='submitted',version=version+1,updated_at=now() where document_id=d.id and key=sec.key;
     perform ee_private.record_revision(d.id,sec.key,'Convite: '||i.label);
   end if;
 end loop;
 return public.ee_open_invite(p_token);
end; $$;

create function ee_private.ee_admin(p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_doc ee_private.documents; sec ee_private.sections; item jsonb; v_key text; result jsonb; scopes text[]; edition_no int; v jsonb; invite_id uuid;
begin
 if not ee_private.is_admin() then raise exception 'Acesso exclusivo do administrador.' using errcode='42501'; end if;
 if p_action='list' then
   return jsonb_build_object('students',coalesce((select jsonb_agg(to_jsonb(s) order by s.name) from ee_private.students s),'[]'::jsonb),
   'documents',coalesce((select jsonb_agg(to_jsonb(x) order by x.updated_at desc) from (select listed.*,(select count(*) from ee_private.sections s where s.document_id=listed.id and s.status='approved') approved,(select count(*) from ee_private.sections s where s.document_id=listed.id) total,(select count(*) from ee_private.sections s where s.document_id=listed.id and s.status='submitted') submitted from ee_private.documents listed) x),'[]'::jsonb));
 elsif p_action='create_student' then
   insert into ee_private.students(name,grade,birth_date) values(trim(p_data->>'name'),trim(p_data->>'grade'),nullif(p_data->>'birth_date','')::date) returning to_jsonb(ee_private.students.*) into result;
   return result;
 elsif p_action='update_student' then
   update ee_private.students set name=trim(p_data->>'name'),grade=trim(p_data->>'grade'),birth_date=nullif(p_data->>'birth_date','')::date where students.id=(p_data->>'id')::uuid returning to_jsonb(ee_private.students.*) into result;
   if result is null then raise exception 'Estudante não encontrado.'; end if;
   return result;
 elsif p_action='create_document' then
   insert into ee_private.documents(student_id,kind,year,term,subject,due_date) values((p_data->>'student_id')::uuid,p_data->>'kind',(p_data->>'year')::int,coalesce((p_data->>'term')::int,0),trim(coalesce(p_data->>'subject','')),nullif(p_data->>'due_date','')::date) returning * into v_doc;
   for item in select value from ee_private.templates t,jsonb_array_elements(t.definition->'sections') where kind=v_doc.kind loop
     v_key:=item->>'id'; v:=coalesce(p_data->'initial'->v_key,'{}'::jsonb);
     perform ee_private.assert_values(v_doc.kind,v_key,v);
     insert into ee_private.sections(document_id,key,values) values(v_doc.id,v_key,v);
     perform ee_private.record_revision(v_doc.id,v_key,'Administrador');
   end loop;
   insert into ee_private.audit(document_id,event,actor) values(v_doc.id,'Documento criado','Administrador');
   return ee_private.snapshot(v_doc.id);
 end if;
 v_id:=(p_data->>'id')::uuid;
 select * into v_doc from ee_private.documents where documents.id=v_id for update;
 if v_doc.id is null then raise exception 'Documento não encontrado.'; end if;
 if p_action='get' then
   return ee_private.snapshot(v_id)||jsonb_build_object('invitations',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'label',i.label,'scopes',i.scopes,'expires_at',i.expires_at,'revoked_at',i.revoked_at) order by i.created_at desc) from ee_private.invitations i where i.document_id=v_id),'[]'::jsonb),
    'editions',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'edition',e.edition,'created_at',e.created_at) order by e.edition desc) from ee_private.editions e where e.document_id=v_id),'[]'::jsonb));
 elsif p_action='edition' then
   select e.snapshot into result from ee_private.editions e where e.document_id=v_id and e.id=(p_data->>'edition_id')::uuid;
   if result is null then raise exception 'Versão não encontrada.'; end if; return result;
 elsif p_action='history' then
   return coalesce((select jsonb_agg(to_jsonb(r) order by r.version desc) from ee_private.revisions r where r.document_id=v_id and r.section_key=p_data->>'key'),'[]'::jsonb);
 elsif p_action='reopen_document' then
   if v_doc.status<>'final' then raise exception 'O documento já está aberto.'; end if;
   update ee_private.documents set status='draft',updated_at=now() where documents.id=v_id;
   update ee_private.sections set status='draft',version=version+1,updated_at=now() where document_id=v_id;
   for v_key in select s.key from ee_private.sections s where s.document_id=v_id loop perform ee_private.record_revision(v_id,v_key,'Administrador: nova edição'); end loop;
   insert into ee_private.audit(document_id,event,actor) values(v_id,'Reabertura; edições anteriores preservadas','Administrador');
   return ee_private.snapshot(v_id);
 elsif p_action='revoke_invite' then
   update ee_private.invitations set revoked_at=now() where document_id=v_id and invitations.id=(p_data->>'invitation_id')::uuid;
   return jsonb_build_object('ok',true);
 end if;
 if v_doc.status='final' then raise exception 'Documento finalizado. Abra uma nova edição para alterar.'; end if;
 if p_action='set_due_date' then
   update ee_private.documents set due_date=nullif(p_data->>'due_date','')::date,updated_at=now() where documents.id=v_id;
 elsif p_action='create_invite' then
   if p_data->>'token' is null or p_data->>'token' !~ '^[0-9a-f]{64}$' then raise exception 'Token inválido.'; end if;
   select array_agg(distinct value) into scopes from jsonb_array_elements_text(p_data->'scopes');
   if scopes is null or cardinality(scopes)=0 or exists(select 1 from unnest(scopes) k where not exists(select 1 from ee_private.sections s where s.document_id=v_id and s.key=k and s.status='draft')) then raise exception 'Selecione áreas abertas para edição.'; end if;
   if p_data->>'expires_at' is null or (p_data->>'expires_at')::timestamptz<=now() or (p_data->>'expires_at')::timestamptz>now()+interval '90 days' then raise exception 'Validade deve estar entre agora e 90 dias.'; end if;
   insert into ee_private.invitations(document_id,token_hash,label,scopes,expires_at) values(v_id,sha256(convert_to(p_data->>'token','UTF8')),trim(p_data->>'label'),scopes,(p_data->>'expires_at')::timestamptz) returning invitations.id into invite_id;
   insert into ee_private.audit(document_id,event,actor) values(v_id,'Convite criado: '||trim(p_data->>'label'),'Administrador');
   return jsonb_build_object('id',invite_id);
 elsif p_action='review' then
   v_key:=p_data->>'key';
   select * into sec from ee_private.sections s where s.document_id=v_id and s.key=v_key for update;
   if sec.key is null or p_data->>'version' is null or sec.version<>(p_data->>'version')::int then raise exception 'CONFLICT: recarregue a área antes de revisar.'; end if;
   if p_data->>'status' not in ('draft','approved') or p_data->>'status' is null then raise exception 'Estado inválido.'; end if;
   if length(coalesce(p_data->>'feedback',''))>5000 then raise exception 'Comentário muito longo.'; end if;
   if p_data->>'status'='approved' and not exists(select 1 from jsonb_each_text(sec.values) e where length(trim(e.value))>0) then raise exception 'A área está vazia. Preencha ou justifique a não aplicação.'; end if;
   update ee_private.sections s set status=p_data->>'status',feedback=coalesce(p_data->>'feedback',''),version=s.version+1,updated_at=now() where s.document_id=v_id and s.key=v_key;
   perform ee_private.record_revision(v_id,v_key,'Administrador: revisão');
 elsif p_action='restore' then
   v_key:=p_data->>'key';
   select * into sec from ee_private.sections s where s.document_id=v_id and s.key=v_key for update;
   if sec.key is null or sec.status<>'draft' or p_data->>'version' is null or sec.version<>(p_data->>'version')::int then raise exception 'CONFLICT: abra a área e recarregue antes de restaurar.'; end if;
   select r.values into v from ee_private.revisions r where r.document_id=v_id and r.section_key=v_key and r.id=(p_data->>'revision_id')::bigint;
   if v is null then raise exception 'Revisão não encontrada.'; end if;
   perform ee_private.assert_values(v_doc.kind,v_key,v);
   update ee_private.sections s set values=v,version=s.version+1,updated_at=now() where s.document_id=v_id and s.key=v_key;
   perform ee_private.record_revision(v_id,v_key,'Administrador: restauração');
 elsif p_action='finalize' then
   if exists(select 1 from ee_private.sections where document_id=v_id and status<>'approved') then raise exception 'Revise e aprove todas as áreas antes de finalizar.'; end if;
   update ee_private.documents set status='final',updated_at=now() where documents.id=v_id;
   select coalesce(max(e.edition),0)+1 into edition_no from ee_private.editions e where e.document_id=v_id;
   insert into ee_private.editions(document_id,edition,snapshot) values(v_id,edition_no,ee_private.snapshot(v_id)||jsonb_build_object('edition',edition_no));
   update ee_private.invitations set revoked_at=now() where document_id=v_id and revoked_at is null;
   insert into ee_private.audit(document_id,event,actor) values(v_id,'Edição '||edition_no||' finalizada','Administrador');
 else raise exception 'Ação desconhecida.';
 end if;
 return ee_private.snapshot(v_id);
end; $$;
create function public.ee_admin(p_action text,p_data jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$ select ee_private.ee_admin(p_action,p_data); $$;
create function public.ee_open_invite(p_token text) returns jsonb language sql security invoker set search_path='' as $$ select ee_private.ee_open_invite(p_token); $$;
create function public.ee_save_section(p_document uuid,p_key text,p_values jsonb,p_version int,p_token text default null) returns jsonb language sql security invoker set search_path='' as $$ select ee_private.ee_save_section(p_document,p_key,p_values,p_version,p_token); $$;
create function public.ee_submit_invite(p_token text,p_versions jsonb) returns jsonb language sql security invoker set search_path='' as $$ select ee_private.ee_submit_invite(p_token,p_versions); $$;
revoke all on all functions in schema ee_private from public,anon,authenticated;
revoke all on function public.ee_admin(text,jsonb) from public,anon,authenticated;
revoke all on function public.ee_open_invite(text) from public,anon,authenticated;
revoke all on function public.ee_save_section(uuid,text,jsonb,int,text) from public,anon,authenticated;
revoke all on function public.ee_submit_invite(text,jsonb) from public,anon,authenticated;
grant execute on function public.ee_admin(text,jsonb) to authenticated;
grant execute on function public.ee_open_invite(text) to anon,authenticated;
grant execute on function public.ee_save_section(uuid,text,jsonb,int,text) to anon,authenticated;
grant execute on function public.ee_submit_invite(text,jsonb) to anon,authenticated;
grant usage on schema ee_private to anon,authenticated;
grant execute on function ee_private.ee_admin(text,jsonb) to authenticated;
grant execute on function ee_private.ee_open_invite(text) to anon,authenticated;
grant execute on function ee_private.ee_save_section(uuid,text,jsonb,int,text) to anon,authenticated;
grant execute on function ee_private.ee_submit_invite(text,jsonb) to anon,authenticated;
-- Bloqueio direto explícito. As funções autorizadas executam sob o proprietário do schema.
do $$ declare t text; begin
 foreach t in array array['administrator','templates','students','documents','sections','invitations','revisions','editions','audit','previous_school_settings'] loop
 execute format('create policy no_direct_client_access on ee_private.%I for all to anon,authenticated using (false) with check (false)',t);
 end loop;
end $$;
-- Se o projeto tiver o gatilho automático do Supabase, ele continua ativo,
-- mas não fica exposto como uma função chamável pela API do cliente.
do $$ begin
 if to_regprocedure('public.rls_auto_enable()') is not null then
 execute 'revoke execute on function public.rls_auto_enable() from public,anon,authenticated';
 end if;
end $$;
commit;
