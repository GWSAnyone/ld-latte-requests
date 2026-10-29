begin;
create function public.valid_image_captions(images jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select not exists (
    select 1 from jsonb_array_elements(images) image
    where image ? 'caption' and (jsonb_typeof(image->'caption') <> 'string' or char_length(image->>'caption') > 500)
  );
$$;
revoke all on function public.valid_image_captions(jsonb) from public;
grant execute on function public.valid_image_captions(jsonb) to authenticated;
alter table public.requests add constraint requests_image_captions_valid check (public.valid_image_captions(images));
commit;
