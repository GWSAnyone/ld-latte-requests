begin;
-- Existing test accounts are used only inside this rolled-back transaction.
select set_config('test.owner_a', (select id::text from auth.users order by created_at limit 1), true);
select set_config('test.owner_b', (select id::text from auth.users order by created_at offset 1 limit 1), true);
do $$ begin assert current_setting('test.owner_a') <> current_setting('test.owner_b'), 'two accounts required'; end $$;
select set_config('test.request_id', gen_random_uuid()::text, true);
select set_config('test.image_id', gen_random_uuid()::text, true);
select set_config('test.image_path', current_setting('test.owner_a') || '/' || current_setting('test.request_id') || '/' || current_setting('test.image_id') || '.webp', true);
insert into storage.objects(bucket_id, name) values ('request-images', current_setting('test.image_path'));
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.owner_a'), 'role','authenticated')::text, true);
set local role authenticated;
insert into public.requests(id,title,description,category,checklist,images)
values (current_setting('test.request_id')::uuid,'Storage acceptance','Rolled back','Другое',
  '[{"id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","text":"Check privacy","done":false}]',
  jsonb_build_array(jsonb_build_object('id',current_setting('test.image_id'),'path',current_setting('test.image_path'),'name','test.webp')));
do $$
declare n integer;
begin
  assert (select count(*)=1 from storage.objects where bucket_id='request-images' and name=current_setting('test.image_path')), 'owner cannot read file';
  -- Deletion is tested through Storage API, not by deleting service metadata.
  begin
    update public.requests set images=jsonb_build_array(jsonb_build_object('id','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','path',current_setting('test.owner_a')||'/'||current_setting('test.request_id')||'/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.webp','name','missing.webp')) where id=current_setting('test.request_id')::uuid;
    raise exception 'missing image accepted';
  exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claims', json_build_object('sub',current_setting('test.owner_b'),'role','authenticated')::text,true);
do $$
declare n integer;
begin
  assert (select count(*)=0 from public.requests where id=current_setting('test.request_id')::uuid), 'foreign request visible';
  assert (select count(*)=0 from storage.objects where name=current_setting('test.image_path')), 'foreign image visible';
  update public.requests set checklist='[]' where id=current_setting('test.request_id')::uuid; get diagnostics n=row_count; assert n=0,'foreign checklist updated';
  begin
    insert into storage.objects(bucket_id,name) values ('request-images',current_setting('test.owner_a')||'/'||gen_random_uuid()||'/'||gen_random_uuid()||'.webp');
    raise exception 'foreign upload allowed';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', json_build_object('sub',current_setting('test.owner_a'),'role','authenticated')::text,true);
update public.requests set images='[]' where id=current_setting('test.request_id')::uuid;
reset role;
rollback;
