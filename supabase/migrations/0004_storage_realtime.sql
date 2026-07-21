-- ============================================================
-- 0004_storage_realtime.sql
-- Storage buckets (private) + Realtime publication setup.
-- ============================================================

-- ------------------------------------------------------------
-- Private storage buckets: receipts, certificates, voice files.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('receipts', 'receipts', false),
  ('certificates', 'certificates', false),
  ('voice-prompts', 'voice-prompts', false),
  ('prize-images', 'prize-images', true)
on conflict (id) do nothing;

-- Only admins may read private buckets from the client; Edge Functions
-- (service_role) upload and generate signed URLs.
create policy "admin read receipts"
  on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and public.is_admin(auth.uid()));

create policy "admin read certificates"
  on storage.objects for select to authenticated
  using (bucket_id = 'certificates' and public.is_admin(auth.uid()));

create policy "admin manage voice prompts"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'voice-prompts'
    and public.has_any_role(auth.uid(), array['super_admin','lottery_manager']::app_role[])
  )
  with check (
    bucket_id = 'voice-prompts'
    and public.has_any_role(auth.uid(), array['super_admin','lottery_manager']::app_role[])
  );

create policy "public read prize images"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'prize-images');

create policy "admin manage prize images"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'prize-images'
    and public.has_any_role(auth.uid(), array['super_admin','lottery_manager']::app_role[])
  )
  with check (
    bucket_id = 'prize-images'
    and public.has_any_role(auth.uid(), array['super_admin','lottery_manager']::app_role[])
  );

-- ------------------------------------------------------------
-- Realtime: expose tables the dashboard subscribes to.
-- ------------------------------------------------------------
alter publication supabase_realtime add table public.participants;
alter publication supabase_realtime add table public.payments;
alter publication supabase_realtime add table public.lotteries;
alter publication supabase_realtime add table public.drawings;
