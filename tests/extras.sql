begin;
select public.valid_request_extras('[]','[]',gen_random_uuid(),gen_random_uuid()) as empty_extras_valid;
do $$
begin
  assert not public.valid_request_extras('[{"id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","text":" ","done":false}]','[]',gen_random_uuid(),gen_random_uuid()), 'blank checklist accepted';
  assert not public.valid_request_extras('[{"id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","text":"ok","done":"false"}]','[]',gen_random_uuid(),gen_random_uuid()), 'invalid done accepted';
  assert not public.valid_request_extras('[]','[{"id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","path":"other/path.webp","name":"x"}]',gen_random_uuid(),gen_random_uuid()), 'foreign image path accepted';
  assert public.valid_request_extras('[{"id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","text":"ok","done":false}]','[]',gen_random_uuid(),gen_random_uuid()), 'valid checklist rejected';
  assert (select not public and file_size_limit=5242880 from storage.buckets where id='request-images'), 'bucket must be private and limited';
  assert not has_column_privilege('authenticated','public.requests','user_id','UPDATE'), 'owner update allowed';
  assert has_column_privilege('authenticated','public.requests','checklist','UPDATE'), 'checklist update denied';
end $$;
rollback;
