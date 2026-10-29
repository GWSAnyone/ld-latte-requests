begin;
select set_config('test.owner_a',(select id::text from auth.users order by created_at limit 1),true);
select set_config('test.owner_b',(select id::text from auth.users order by created_at offset 1 limit 1),true);
select set_config('test.id',gen_random_uuid()::text,true);
do $$ begin assert current_setting('test.owner_a') <> current_setting('test.owner_b'), 'two accounts required'; end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.owner_a'),'role','authenticated')::text,true);
set local role authenticated;
insert into public.requests(id,title,description,category) values(current_setting('test.id')::uuid,'Delete acceptance','Rolled back','Другое');
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.owner_b'),'role','authenticated')::text,true);
do $$ declare n integer; begin
 delete from public.requests where id=current_setting('test.id')::uuid;
 get diagnostics n=row_count; assert n=0,'foreign DELETE allowed';
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.owner_a'),'role','authenticated')::text,true);
do $$ declare n integer; begin
 delete from public.requests where id=current_setting('test.id')::uuid;
 get diagnostics n=row_count; assert n=1,'own DELETE denied';
 assert not exists(select 1 from public.requests where id=current_setting('test.id')::uuid),'row remains';
end $$;
reset role;
rollback;
