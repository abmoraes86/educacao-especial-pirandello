begin;
create table ee_private.routine_schedules (
 effective date primary key check(extract(isodow from effective)=1),
 slots jsonb not null check(jsonb_typeof(slots)='array' and jsonb_array_length(slots) between 1 and 12)
);
create table ee_private.routine_teachers (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 150),
 class_name text not null check(length(trim(class_name)) between 1 and 100),
 year int not null check(year between 2020 and 2100), token_hash bytea unique,
 created_at timestamptz not null default now()
);
create table ee_private.routine_weeks (
 teacher_id uuid not null references ee_private.routine_teachers(id), week date not null check(extract(isodow from week)=1),
 slots jsonb not null, content jsonb not null default '{}', version int not null default 0,
 status text not null default 'draft' check(status in ('draft','submitted','changes','approved')),
 updated_at timestamptz not null default now(), primary key(teacher_id,week)
);
create table ee_private.routine_comments (
 id bigint generated always as identity primary key,
 teacher_id uuid not null, week date not null, body text not null check(length(trim(body)) between 1 and 5000),
 version int not null, status text not null, created_at timestamptz not null default now(),
 foreign key(teacher_id,week) references ee_private.routine_weeks(teacher_id,week)
);
create index routine_comments_week_idx on ee_private.routine_comments(teacher_id,week);
alter table ee_private.routine_schedules enable row level security;
alter table ee_private.routine_teachers enable row level security;
alter table ee_private.routine_weeks enable row level security;
alter table ee_private.routine_comments enable row level security;
revoke all on ee_private.routine_schedules,ee_private.routine_teachers,ee_private.routine_weeks,ee_private.routine_comments from public,anon,authenticated;

create function ee_private.routines(p_action text,p_data jsonb,p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a boolean:=ee_private.is_admin(); t ee_private.routine_teachers; w ee_private.routine_weeks;
 d date; s jsonb; c jsonb; item record; v int; result jsonb;
begin
 if p_token is not null then
  a:=false;
  if p_token !~ '^[a-f0-9]{64}$' then raise exception 'Link inválido ou revogado.'; end if;
  select * into t from ee_private.routine_teachers where token_hash=sha256(convert_to(p_token,'UTF8')) for update;
  if not found then raise exception 'Link inválido ou revogado.'; end if;
 elsif not a then raise exception 'Acesso exclusivo da coordenação.';
 end if;
 if p_action='list' and a then
  return jsonb_build_object('teachers',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'class_name',class_name,'year',year,'active',token_hash is not null) order by year desc,name) from ee_private.routine_teachers),'[]'::jsonb),
   'schedules',coalesce((select jsonb_agg(to_jsonb(x) order by effective desc) from ee_private.routine_schedules x),'[]'::jsonb),
   'weeks',coalesce((select jsonb_agg(jsonb_build_object('teacher_id',teacher_id,'week',week,'status',status,'updated_at',updated_at)) from ee_private.routine_weeks),'[]'::jsonb));
 elsif p_action='schedule' and a then
  d:=(p_data->>'effective')::date; s:=p_data->'slots';
  if d is null or jsonb_typeof(s) is distinct from 'array' then raise exception 'Informe a semana e os horários.'; end if;
  for item in select value from jsonb_array_elements(s) loop
   if jsonb_typeof(item.value) is distinct from 'string' or length(trim(item.value#>>'{}')) not between 1 and 100 then raise exception 'Cada horário deve conter de 1 a 100 caracteres.'; end if;
  end loop;
  insert into ee_private.routine_schedules values(d,s) on conflict(effective) do update set slots=excluded.slots;
  return jsonb_build_object('saved',true);
 elsif p_action='create_teacher' and a then
  if coalesce(p_data->>'token','') !~ '^[a-f0-9]{64}$' then raise exception 'Link inválido.'; end if;
  insert into ee_private.routine_teachers(name,class_name,year,token_hash) values(trim(p_data->>'name'),trim(p_data->>'class_name'),(p_data->>'year')::int,sha256(convert_to(p_data->>'token','UTF8'))) returning * into t;
  return jsonb_build_object('id',t.id);
 elsif p_action in ('rotate','revoke') and a then
  if p_action='rotate' and coalesce(p_data->>'token','') !~ '^[a-f0-9]{64}$' then raise exception 'Link inválido.'; end if;
  update ee_private.routine_teachers set token_hash=case when p_action='rotate' then sha256(convert_to(p_data->>'token','UTF8')) else null end where id=(p_data->>'id')::uuid;
  if not found then raise exception 'Professor não encontrado.'; end if;
  return jsonb_build_object('saved',true);
 end if;
 if a then
  select * into t from ee_private.routine_teachers where id=(p_data->>'id')::uuid for update;
  if not found then raise exception 'Professor não encontrado.'; end if;
 end if;
 if p_action='identity' then return jsonb_build_object('id',t.id,'name',t.name,'class_name',t.class_name,'year',t.year); end if;
 d:=(p_data->>'week')::date;
 if d is null or extract(isodow from d)<>1 or extract(year from d+3)<>t.year then raise exception 'Escolha uma semana do ano cadastrado para o professor.'; end if;
 select * into w from ee_private.routine_weeks where teacher_id=t.id and week=d for update;
 select slots into s from ee_private.routine_schedules where effective<=d order by effective desc limit 1;
 s:=coalesce(w.slots,s);
 if p_action='get' then
  return jsonb_build_object('teacher',jsonb_build_object('id',t.id,'name',t.name,'class_name',t.class_name,'year',t.year),
   'week',d,'slots',s,'content',coalesce(w.content,'{}'::jsonb),'version',coalesce(w.version,0),'status',coalesce(w.status,'draft'),
   'comments',coalesce((select jsonb_agg(to_jsonb(x)-'teacher_id' order by created_at,id) from ee_private.routine_comments x where teacher_id=t.id and week=d),'[]'::jsonb));
 elsif p_action='identity' then
  return jsonb_build_object('id',t.id,'name',t.name,'class_name',t.class_name,'year',t.year);
 elsif p_action in ('save','review') then
  if s is null then raise exception 'A coordenação precisa configurar os horários desta semana.'; end if;
  if (p_data->>'version')::int is distinct from coalesce(w.version,0) then raise exception 'CONFLICT: esta semana mudou em outra aba. Copie seu texto e recarregue antes de salvar.'; end if;
  if p_action='save' then
   if p_data->'slots' is distinct from s then raise exception 'Os horários mudaram. Copie seu texto e recarregue a semana.'; end if;
   c:=p_data->'content';
   if jsonb_typeof(c) is distinct from 'object' then raise exception 'Conteúdo inválido.'; end if;
   for item in select * from jsonb_each(c) loop
    if item.key !~ '^(d[0-4]_(reading|author|genre|s([0-9]|1[01])_(subject|content))|notes|difficulties|absences)$'
     or jsonb_typeof(item.value) is distinct from 'string' or length(item.value#>>'{}')>12000 then raise exception 'Campo inválido ou texto acima de 12.000 caracteres.'; end if;
    if item.key ~ '_s' and substring(item.key from '_s([0-9]+)_')::int>=jsonb_array_length(s) then raise exception 'Aula inexistente.'; end if;
   end loop;
   if coalesce(p_data->>'status','draft') not in ('draft','submitted') then raise exception 'Situação inválida.'; end if;
   insert into ee_private.routine_weeks(teacher_id,week,slots,content,version,status) values(t.id,d,s,c,1,coalesce(p_data->>'status','draft'))
    on conflict(teacher_id,week) do update set content=excluded.content,version=routine_weeks.version+1,status=excluded.status,updated_at=now() returning * into w;
  else
   if not a then raise exception 'Somente a coordenação pode avaliar.'; end if;
   if w.teacher_id is null then raise exception 'O professor precisa salvar a semana primeiro.'; end if;
   if coalesce(p_data->>'status','') not in ('changes','approved') then raise exception 'Situação inválida.'; end if;
   insert into ee_private.routine_comments(teacher_id,week,body,version,status) values(t.id,d,trim(p_data->>'body'),w.version,p_data->>'status');
   update ee_private.routine_weeks set status=p_data->>'status',version=version+1,updated_at=now() where teacher_id=t.id and week=d returning * into w;
  end if;
  return jsonb_build_object('saved',true,'version',w.version,'status',w.status);
 end if;
 raise exception 'Operação inválida.';
end $$;
create function public.ee_routines(p_action text,p_data jsonb default '{}',p_token text default null) returns jsonb
language sql security invoker set search_path='' as $$select ee_private.routines(p_action,p_data,p_token)$$;
revoke all on function ee_private.routines(text,jsonb,text),public.ee_routines(text,jsonb,text) from public;
grant execute on function ee_private.routines(text,jsonb,text),public.ee_routines(text,jsonb,text) to anon,authenticated;
commit;
