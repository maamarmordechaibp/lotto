-- ============================================================
-- 0004_rls.sql
-- Row Level Security on ALL tables.
--   * service_role (Edge Functions) bypasses RLS entirely.
--   * anon/public: read-only access to public lottery info + winners.
--   * authenticated admins: access gated by role via has_role().
-- ============================================================

-- Enable RLS everywhere.
alter table public.admins        enable row level security;
alter table public.user_roles    enable row level security;
alter table public.lotteries     enable row level security;
alter table public.participants  enable row level security;
alter table public.payments      enable row level security;
alter table public.drawings      enable row level security;
alter table public.call_logs     enable row level security;
alter table public.sms_logs      enable row level security;
alter table public.email_logs    enable row level security;
alter table public.voice_prompts enable row level security;
alter table public.audit_logs    enable row level security;
alter table public.settings      enable row level security;
alter table public.activity_logs enable row level security;
alter table public.webhook_logs  enable row level security;
alter table public.rate_limits   enable row level security;

-- Force RLS even for table owners (defense in depth). service_role still bypasses.
alter table public.participants  force row level security;
alter table public.payments      force row level security;

-- ------------------------------------------------------------
-- Convenience: roles allowed to manage lotteries / view data.
-- ------------------------------------------------------------
-- lotteries: public can read OPEN/PAUSED/COMPLETED (not draft), admins manage.
create policy lotteries_public_read on public.lotteries
  for select to anon, authenticated
  using (deleted_at is null and status in ('open', 'paused', 'closed', 'completed'));

create policy lotteries_admin_read on public.lotteries
  for select to authenticated
  using (public.is_admin(auth.uid()));

create policy lotteries_manage on public.lotteries
  for all to authenticated
  using (public.has_any_role(auth.uid(), array['super_admin','lottery_manager']::app_role[]))
  with check (public.has_any_role(auth.uid(), array['super_admin','lottery_manager']::app_role[]));

-- drawings: winners are public; only super_admin/lottery_manager insert (via fn).
create policy drawings_public_read on public.drawings
  for select to anon, authenticated using (true);

create policy drawings_admin_all on public.drawings
  for all to authenticated
  using (public.has_any_role(auth.uid(), array['super_admin','lottery_manager']::app_role[]))
  with check (public.has_any_role(auth.uid(), array['super_admin','lottery_manager']::app_role[]));

-- participants: admins only (support/viewer read; managers write).
create policy participants_read on public.participants
  for select to authenticated
  using (public.is_admin(auth.uid()));

create policy participants_write on public.participants
  for all to authenticated
  using (public.has_any_role(auth.uid(), array['super_admin','lottery_manager']::app_role[]))
  with check (public.has_any_role(auth.uid(), array['super_admin','lottery_manager']::app_role[]));

-- payments: admins read; managers/super_admin write.
create policy payments_read on public.payments
  for select to authenticated
  using (public.is_admin(auth.uid()));

create policy payments_write on public.payments
  for all to authenticated
  using (public.has_any_role(auth.uid(), array['super_admin','lottery_manager']::app_role[]))
  with check (public.has_any_role(auth.uid(), array['super_admin','lottery_manager']::app_role[]));

-- admins table: a user reads their own profile; super_admin manages all.
create policy admins_self_read on public.admins
  for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'super_admin'));

create policy admins_super_manage on public.admins
  for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

-- user_roles: user reads own roles; only super_admin manages.
create policy user_roles_self_read on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'super_admin'));

create policy user_roles_super_manage on public.user_roles
  for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

-- voice_prompts: public read (for playback), managers write.
create policy voice_prompts_public_read on public.voice_prompts
  for select to anon, authenticated using (true);

create policy voice_prompts_manage on public.voice_prompts
  for all to authenticated
  using (public.has_any_role(auth.uid(), array['super_admin','lottery_manager']::app_role[]))
  with check (public.has_any_role(auth.uid(), array['super_admin','lottery_manager']::app_role[]));

-- settings: admins read, super_admin write.
create policy settings_read on public.settings
  for select to authenticated using (public.is_admin(auth.uid()));
create policy settings_write on public.settings
  for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

-- Log tables: admins read-only from client; writes only via service_role.
do $$
declare t text;
begin
  foreach t in array array[
    'call_logs','sms_logs','email_logs','audit_logs',
    'activity_logs','webhook_logs','rate_limits'
  ] loop
    execute format(
      'create policy %1$s_admin_read on public.%1$s
         for select to authenticated using (public.is_admin(auth.uid()));', t);
  end loop;
end;
$$;

-- NOTE: No INSERT/UPDATE/DELETE policies for anon on any table.
-- All writes for entries/payments/logs happen exclusively through
-- Edge Functions using the service_role key, which bypasses RLS.
