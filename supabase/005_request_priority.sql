begin;
alter table public.requests add column priority text not null default 'Не срочно'
  constraint requests_priority_valid check (priority in ('Срочно', 'Важно', 'Не срочно'));
grant insert (priority), update (priority) on public.requests to authenticated;
notify pgrst, 'reload schema';
commit;
