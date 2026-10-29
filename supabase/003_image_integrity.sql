begin;
create function public.check_request_images_exist()
returns trigger language plpgsql set search_path = '' as $$
declare image jsonb;
begin
  for image in select value from jsonb_array_elements(new.images) loop
    if not exists (select 1 from storage.objects where bucket_id = 'request-images' and name = image->>'path') then
      raise exception 'Attached image must exist in private storage' using errcode = '23514';
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function public.check_request_images_exist() from public;
create trigger requests_image_integrity before insert or update of images on public.requests
for each row execute function public.check_request_images_exist();
commit;
