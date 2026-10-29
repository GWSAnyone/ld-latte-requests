begin;
do $$ begin
  assert public.valid_image_captions('[{"name":"old.webp"}]'), 'old images must remain valid';
  assert public.valid_image_captions('[{"caption":"Пример процесса"}]'), 'caption rejected';
  assert not public.valid_image_captions('[{"caption":42}]'), 'non-string caption accepted';
  assert not public.valid_image_captions('[{"caption":null}]'), 'null caption accepted';
  assert not public.valid_image_captions(jsonb_build_array(jsonb_build_object('caption', repeat('x',501)))), 'long caption accepted';
end $$;
rollback;
