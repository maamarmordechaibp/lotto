-- ============================================================
-- seed.sql — development seed data.
-- Applied automatically by `supabase db reset` after migrations.
-- ============================================================

-- ------------------------------------------------------------
-- Bootstrap a super_admin auth user (dev only!).
--   email:    admin@lottery.test
--   password: Admin123!
-- ------------------------------------------------------------
do $$
declare
  v_uid uuid := '00000000-0000-0000-0000-0000000000a1';
begin
  if not exists (select 1 from auth.users where id = v_uid) then
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    ) values (
      v_uid,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'admin@lottery.test',
      crypt('Admin123!', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Platform Admin"}'
    );
  end if;

  insert into public.admins (id, email, full_name)
  values (v_uid, 'admin@lottery.test', 'Platform Admin')
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (v_uid, 'super_admin')
  on conflict (user_id, role) do nothing;
end;
$$;

-- ------------------------------------------------------------
-- Global settings.
-- ------------------------------------------------------------
insert into public.settings (key, value, description) values
  ('currency', '"USD"', 'Default display currency'),
  ('timezone', '"America/New_York"', 'Default timezone'),
  ('sms_sender_id', '"LOTTO"', 'Default SMS sender id'),
  ('call_recording_enabled', 'false', 'Record inbound calls')
on conflict (key) do nothing;

-- ------------------------------------------------------------
-- Sample lottery (OPEN), $1–$500, 500 participants.
-- ------------------------------------------------------------
insert into public.lotteries (
  id, name, description, prize_text, status,
  start_date, end_date, drawing_date,
  max_participants, min_charge, max_charge,
  created_by
) values (
  '11111111-1111-1111-1111-111111111111',
  'Summer Grand Prize',
  'Enter for a chance to win our summer grand prize. Your charge equals your ticket number.',
  'Brand-new electric vehicle',
  'open',
  now() - interval '1 day',
  now() + interval '30 days',
  now() + interval '31 days',
  500, 1, 500,
  '00000000-0000-0000-0000-0000000000a1'
) on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Voice prompts for the sample lottery.
-- ------------------------------------------------------------
insert into public.voice_prompts (lottery_id, slot, language, text_content) values
  ('11111111-1111-1111-1111-111111111111', 'welcome_greeting', 'en',
   'Welcome to the Summer Grand Prize lottery.'),
  ('11111111-1111-1111-1111-111111111111', 'lottery_explanation', 'en',
   'The prize is a brand new electric vehicle. You will be charged a randomly selected amount between 1 and 500 dollars. That amount becomes your ticket number.'),
  ('11111111-1111-1111-1111-111111111111', 'payment_instructions', 'en',
   'Please have your card ready for our secure payment system.'),
  ('11111111-1111-1111-1111-111111111111', 'confirmation_message', 'en',
   'Congratulations! Your ticket number is {{ticketNumber}}. You have been charged {{amountDollars}} dollars. Good luck!'),
  ('11111111-1111-1111-1111-111111111111', 'goodbye_message', 'en',
   'Thank you for calling. Goodbye.'),
  ('11111111-1111-1111-1111-111111111111', 'error_message', 'en',
   'We are sorry, an error occurred. Please try again later.')
on conflict (lottery_id, slot, language) do nothing;
