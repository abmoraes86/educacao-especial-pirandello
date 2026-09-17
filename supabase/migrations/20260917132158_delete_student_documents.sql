-- Exclusão explícita e atômica, sem alterar exclusões das demais tabelas.
create or replace function ee_private.delete_student(p_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target ee_private.students; ids uuid[]; n integer;
begin
 if not ee_private.is_admin() then
  raise exception 'Acesso exclusivo do administrador.' using errcode='42501';
 end if;
 if p_data->>'confirmation' is distinct from 'EXCLUIR' then
  raise exception 'Digite EXCLUIR para confirmar.';
 end if;
 select * into target from ee_private.students where id=(p_data->>'id')::uuid for update;
 if target.id is null then raise exception 'Estudante não encontrado.'; end if;
 if p_data->>'name' is distinct from target.name then
  raise exception 'Cadastro alterado. Reabra a confirmação.';
 end if;
 -- O lock do estudante bloqueia novos documentos via chave estrangeira.
 -- Os locks dos documentos serializam salvamentos, convites e finalizações.
 perform id from ee_private.documents where student_id=target.id order by id for update;
 select coalesce(array_agg(id),'{}'::uuid[]) into ids from ee_private.documents where student_id=target.id;
 n:=cardinality(ids);
 if (p_data->>'documents_count')::integer is distinct from n then
  raise exception 'A quantidade de documentos mudou. Reabra a confirmação.';
 end if;
 delete from ee_private.revisions where document_id=any(ids);
 delete from ee_private.editions where document_id=any(ids);
 delete from ee_private.invitations where document_id=any(ids);
 delete from ee_private.audit where document_id=any(ids);
 delete from ee_private.sections where document_id=any(ids);
 delete from ee_private.documents where id=any(ids);
 delete from ee_private.students where id=target.id;
 return jsonb_build_object('deleted',true,'documents_count',n);
end; $$;
revoke all on function ee_private.delete_student(jsonb) from public,anon,authenticated;
grant execute on function ee_private.delete_student(jsonb) to authenticated;

create or replace function public.ee_admin(p_action text,p_data jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if p_action='delete_student' then return ee_private.delete_student(p_data); end if;
 return ee_private.ee_admin(p_action,p_data);
end; $$;
revoke all on function public.ee_admin(text,jsonb) from public,anon,authenticated;
grant execute on function public.ee_admin(text,jsonb) to authenticated;
