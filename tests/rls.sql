-- Run against the application database with psql -v ON_ERROR_STOP=1.
-- All fixtures and changes are rolled back.
begin;

insert into auth.users (id, email)
values
  ('d0f954fb-00f7-4e40-976f-b8c2a76a0011', 'rls-a@example.invalid'),
  ('d0f954fb-00f7-4e40-976f-b8c2a76a0022', 'rls-b@example.invalid');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd0f954fb-00f7-4e40-976f-b8c2a76a0011', true);
insert into public.requests (id, title, description, category)
values ('d0f954fb-00f7-4e40-976f-b8c2a76a0033', 'RLS fixture', 'Test request', 'Бот');

do $$
begin
  if not exists (select 1 from public.requests where id = 'd0f954fb-00f7-4e40-976f-b8c2a76a0033' and status = 'Новая') then
    raise exception 'Owner cannot read new request with default status';
  end if;
  update public.requests set status = 'В работе' where id = 'd0f954fb-00f7-4e40-976f-b8c2a76a0033';
  if not found then raise exception 'Owner cannot update own request'; end if;
  begin
    update public.requests set user_id = 'd0f954fb-00f7-4e40-976f-b8c2a76a0022' where id = 'd0f954fb-00f7-4e40-976f-b8c2a76a0033';
    raise exception 'Owner reassignment was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.requests (title, description, category, status) values ('Test', 'Description', 'Бот', 'Завершена');
    raise exception 'Client initial status was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.requests (title, description, category) values ('   ', 'Description', 'Бот');
    raise exception 'Blank title was allowed';
  exception when check_violation then null;
  end;
  begin
    insert into public.requests (title, description, category) values ('Test', '', 'Бот');
    raise exception 'Blank description was allowed';
  exception when check_violation then null;
  end;
  begin
    insert into public.requests (title, description, category) values ('Test', 'Description', 'Invalid');
    raise exception 'Invalid category was allowed';
  exception when check_violation then null;
  end;
  begin
    update public.requests set status = 'Invalid' where id = 'd0f954fb-00f7-4e40-976f-b8c2a76a0033';
    raise exception 'Invalid status was allowed';
  exception when check_violation then null;
  end;
  raise notice 'PASS owner read/update, defaults, immutable owner and validation';
end;
$$;

select set_config('request.jwt.claim.sub', 'd0f954fb-00f7-4e40-976f-b8c2a76a0022', true);
do $$
begin
  if exists (select 1 from public.requests where id = 'd0f954fb-00f7-4e40-976f-b8c2a76a0033') then
    raise exception 'Other user can read request';
  end if;
  update public.requests set title = 'Foreign change' where id = 'd0f954fb-00f7-4e40-976f-b8c2a76a0033';
  if found then raise exception 'Other user can update request'; end if;
  begin
    insert into public.requests (user_id, title, description, category)
    values ('d0f954fb-00f7-4e40-976f-b8c2a76a0011', 'Test', 'Description', 'Бот');
    raise exception 'Forged owner was allowed';
  exception when insufficient_privilege then null;
  end;
  delete from public.requests where id = 'd0f954fb-00f7-4e40-976f-b8c2a76a0033';
  if found then raise exception 'Other user can delete request'; end if;
  raise notice 'PASS second user cannot read, update, delete or forge owner';
end;
$$;

select set_config('request.jwt.claim.sub', 'd0f954fb-00f7-4e40-976f-b8c2a76a0011', true);
do $$
begin
  delete from public.requests where id = 'd0f954fb-00f7-4e40-976f-b8c2a76a0033';
  if not found then raise exception 'Owner cannot delete own request'; end if;
  raise notice 'PASS owner can delete own request';
end;
$$;

set local role anon;
do $$
begin
  begin
    perform 1 from public.requests;
    raise exception 'Anonymous reads were allowed';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS anonymous access denied';
end;
$$;
rollback;
