begin;

create function public.valid_request_extras(checklist jsonb, images jsonb, owner uuid, request_id uuid)
returns boolean language plpgsql immutable set search_path = '' as $$
declare entry jsonb; seen text[] := '{}';
begin
  if jsonb_typeof(checklist) <> 'array' or jsonb_typeof(images) <> 'array' then return false; end if;
  if jsonb_array_length(checklist) > 30 or jsonb_array_length(images) > 3 then return false; end if;
  for entry in select value from jsonb_array_elements(checklist) loop
    if jsonb_typeof(entry) <> 'object' or jsonb_typeof(entry->'text') is distinct from 'string'
      or jsonb_typeof(entry->'done') is distinct from 'boolean' or jsonb_typeof(entry->'id') is distinct from 'string'
      or char_length(btrim(entry->>'text')) not between 1 and 300
      or (entry->>'id') !~ '^[0-9a-f-]{36}$' or (entry->>'id') = any(seen) then return false; end if;
    seen := array_append(seen, entry->>'id');
  end loop;
  seen := '{}';
  for entry in select value from jsonb_array_elements(images) loop
    if jsonb_typeof(entry) <> 'object' or jsonb_typeof(entry->'id') is distinct from 'string'
      or jsonb_typeof(entry->'path') is distinct from 'string' or jsonb_typeof(entry->'name') is distinct from 'string'
      or char_length(entry->>'name') not between 1 and 160
      or (entry->>'id') !~ '^[0-9a-f-]{36}$' or (entry->>'id') = any(seen)
      or (entry->>'path') <> owner::text || '/' || request_id::text || '/' || (entry->>'id') || '.webp' then return false; end if;
    seen := array_append(seen, entry->>'id');
  end loop;
  return true;
end;
$$;
revoke all on function public.valid_request_extras(jsonb,jsonb,uuid,uuid) from public;
grant execute on function public.valid_request_extras(jsonb,jsonb,uuid,uuid) to authenticated;

alter table public.requests add column checklist jsonb not null default '[]', add column images jsonb not null default '[]';
alter table public.requests add constraint requests_extras_valid check (public.valid_request_extras(checklist, images, user_id, id));
grant insert (checklist, images), update (checklist, images) on public.requests to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('request-images', 'request-images', false, 5242880, array['image/webp']);

create policy "Upload own request images" on storage.objects for insert to authenticated
with check (bucket_id = 'request-images' and (storage.foldername(name))[1] = (select auth.uid())::text
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$');
create policy "Read own request images" on storage.objects for select to authenticated
using (bucket_id = 'request-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Remove detached own images" on storage.objects for delete to authenticated
using (bucket_id = 'request-images' and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (select 1 from public.requests r where r.user_id = (select auth.uid()) and r.images @> jsonb_build_array(jsonb_build_object('path', name))));

notify pgrst, 'reload schema';
commit;
