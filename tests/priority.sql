begin;
select set_config('test.owner', (select id::text from auth.users order by created_at limit 1), true);
select set_config('test.id', gen_random_uuid()::text, true);
select set_config('request.jwt.claims', json_build_object('sub',current_setting('test.owner'),'role','authenticated')::text,true);
set local role authenticated;
insert into public.requests(id,title,description,category) values(current_setting('test.id')::uuid,'Priority test','Rolled back','Другое');
do $$ begin
 assert (select priority='Не срочно' from public.requests where id=current_setting('test.id')::uuid), 'wrong default';
 update public.requests set priority='Срочно' where id=current_setting('test.id')::uuid;
 assert (select priority='Срочно' from public.requests where id=current_setting('test.id')::uuid), 'priority update failed';
 begin
   update public.requests set priority='invalid' where id=current_setting('test.id')::uuid;
   raise exception 'invalid priority accepted';
 exception when check_violation then null; end;
 begin
   update public.requests set priority=null where id=current_setting('test.id')::uuid;
   raise exception 'null priority accepted';
 exception when not_null_violation then null; end;
end $$;
reset role;
rollback;
