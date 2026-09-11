-- Executar só após criar a conta em Authentication → Users.
-- Trocar o e-mail abaixo pelo escolhido pelo responsável. Nunca colocar senha aqui.
-- Não modifica contas nem escolhe automaticamente o primeiro usuário.
begin;
do $$
declare
 chosen_email text := 'SUBSTITUIR_PELO_EMAIL_DO_ADMINISTRADOR';
 chosen_id uuid;
begin
 if chosen_email='SUBSTITUIR_PELO_EMAIL_DO_ADMINISTRADOR' then
   raise exception 'Informe o e-mail escolhido antes de executar.';
 end if;
 if exists(select 1 from ee_private.administrator) then
   raise exception 'Já existe administrador. Nenhuma alteração aplicada.';
 end if;
 select id into strict chosen_id from auth.users
 where lower(email)=lower(chosen_email) and email_confirmed_at is not null;
 insert into ee_private.administrator(user_id) values(chosen_id);
end $$;
commit;
-- A consulta abaixo revela apenas o e-mail autorizado, nunca credenciais.
select u.email from ee_private.administrator a join auth.users u on u.id=a.user_id;
