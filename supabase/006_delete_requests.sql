begin;
grant delete on public.requests to authenticated;
create policy "Delete own requests" on public.requests
  for delete to authenticated using ((select auth.uid()) = user_id);
notify pgrst, 'reload schema';
commit;
