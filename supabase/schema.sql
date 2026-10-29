begin;

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text not null check (char_length(btrim(description)) between 1 and 10000),
  category text not null check (category in ('Бот', 'Интеграция', 'Отчёт', 'Другое')),
  status text not null default 'Новая' check (status in ('Новая', 'В работе', 'Завершена')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index requests_user_created_idx on public.requests (user_id, created_at desc);
alter table public.requests enable row level security;

revoke all on public.requests from anon, authenticated;
grant select on public.requests to authenticated;
grant insert (id, title, description, category) on public.requests to authenticated;
grant update (title, description, category, status) on public.requests to authenticated;

create policy "Read own requests" on public.requests
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own requests" on public.requests
  for insert to authenticated with check ((select auth.uid()) = user_id and status = 'Новая');
create policy "Update own requests" on public.requests
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create function public.set_request_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.set_request_updated_at() from public;
create trigger requests_updated_at before update on public.requests
  for each row execute function public.set_request_updated_at();

commit;
