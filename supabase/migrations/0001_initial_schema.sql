-- ============================================================
-- 0001_initial_schema.sql
-- Voice-First Lottery Platform — core schema
-- ------------------------------------------------------------
-- Conventions:
--   * All monetary values stored as INTEGER (cents), EXCEPT
--     ticket_number which is a whole-dollar integer that also
--     equals the exact dollar charge (ticket #247 => $247 =>
--     amount_cents 24700).
--   * Soft deletes via deleted_at.
--   * UNIQUE (lottery_id, ticket_number) enforced on participants.
-- ============================================================

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------
create type lottery_status as enum ('draft', 'open', 'paused', 'closed', 'completed');
create type entry_channel  as enum ('phone', 'web');
create type payment_status as enum (
  'pending', 'authorized', 'captured', 'failed', 'voided', 'refunded', 'partially_refunded'
);
create type app_role as enum ('super_admin', 'lottery_manager', 'support', 'viewer');

-- ------------------------------------------------------------
-- admins — admin profiles linked to Supabase Auth
-- ------------------------------------------------------------
create table public.admins (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text not null unique,
  full_name    text,
  avatar_url   text,
  is_active    boolean not null default true,
  last_login_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- ------------------------------------------------------------
-- user_roles — role assignments
-- ------------------------------------------------------------
create table public.user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

-- ------------------------------------------------------------
-- lotteries — lottery definitions
-- ------------------------------------------------------------
create table public.lotteries (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  description        text,
  prize_text         text,
  prize_image_url    text,
  start_date         timestamptz not null,
  end_date           timestamptz not null,
  drawing_date       timestamptz,
  max_participants   integer not null check (max_participants > 0),
  -- Charge range in whole dollars; each is also a candidate ticket number.
  min_charge         integer not null check (min_charge >= 1),
  max_charge         integer not null check (max_charge >= min_charge),
  status             lottery_status not null default 'draft',
  -- Templates / prompts
  sms_template       text,
  email_subject      text,
  email_template     text,
  voice_greeting_text text,
  voice_greeting_url text,
  -- Rate limiting overrides (nullable => use global settings)
  rate_limit_per_phone integer,
  rate_limit_per_ip    integer,
  currency           text not null default 'USD',
  timezone           text not null default 'UTC',
  created_by         uuid references auth.users (id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  constraint charge_range_within_participants
    check (max_charge - min_charge + 1 >= 1)
);

-- ------------------------------------------------------------
-- participants — registered entrants + ticket assignment
-- ------------------------------------------------------------
create table public.participants (
  id             uuid primary key default gen_random_uuid(),
  lottery_id     uuid not null references public.lotteries (id) on delete cascade,
  ticket_number  integer not null,           -- equals dollar charge
  amount_cents   integer not null,           -- ticket_number * 100
  first_name     text not null,
  last_name      text not null,
  phone          text not null,
  email          text,
  address        text,
  channel        entry_channel not null,
  payment_status payment_status not null default 'pending',
  payment_reference text,                     -- Sola transaction id
  is_flagged     boolean not null default false,
  admin_note     text,
  receipt_path   text,                        -- Supabase Storage path
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  constraint uq_lottery_ticket unique (lottery_id, ticket_number),
  constraint ticket_matches_amount check (amount_cents = ticket_number * 100)
);

-- ------------------------------------------------------------
-- payments — payment records (Sola gateway data)
-- ------------------------------------------------------------
create table public.payments (
  id                uuid primary key default gen_random_uuid(),
  participant_id    uuid references public.participants (id) on delete set null,
  lottery_id        uuid not null references public.lotteries (id) on delete cascade,
  gateway           text not null default 'sola',
  gateway_reference text,                     -- Sola transaction / auth id
  session_id        text,                     -- hosted checkout / IVR session id
  auth_id           text,                     -- authorization id
  status            payment_status not null default 'pending',
  authorized_cents  integer,                  -- amount authorized (may be max range)
  amount_cents      integer not null,         -- amount captured (ticket amount)
  refunded_cents    integer not null default 0,
  currency          text not null default 'USD',
  settlement_status text,
  -- Never store raw card data. Store hashed/redacted response only.
  raw_response_hash text,
  raw_response      jsonb,                     -- redacted, no PAN
  error_code        text,
  error_message     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

-- ------------------------------------------------------------
-- drawings — winner records per lottery
-- ------------------------------------------------------------
create table public.drawings (
  id                 uuid primary key default gen_random_uuid(),
  lottery_id         uuid not null references public.lotteries (id) on delete cascade,
  participant_id     uuid not null references public.participants (id),
  winner_ticket_number integer not null,
  amount_cents       integer not null,
  certificate_path   text,
  drawn_by           uuid references auth.users (id),
  drawn_at           timestamptz not null default now(),
  created_at         timestamptz not null default now()
);

-- ------------------------------------------------------------
-- call_logs — SignalWire call events
-- ------------------------------------------------------------
create table public.call_logs (
  id             uuid primary key default gen_random_uuid(),
  lottery_id     uuid references public.lotteries (id) on delete set null,
  participant_id uuid references public.participants (id) on delete set null,
  call_sid       text,
  from_number    text,
  to_number      text,
  direction      text,
  status         text,
  duration_seconds integer,
  recording_url  text,
  events         jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ------------------------------------------------------------
-- sms_logs — outbound SMS records
-- ------------------------------------------------------------
create table public.sms_logs (
  id             uuid primary key default gen_random_uuid(),
  participant_id uuid references public.participants (id) on delete set null,
  to_number      text not null,
  body           text not null,
  provider_sid   text,
  status         text not null default 'queued',
  error_message  text,
  created_at     timestamptz not null default now()
);

-- ------------------------------------------------------------
-- email_logs — outbound email records
-- ------------------------------------------------------------
create table public.email_logs (
  id             uuid primary key default gen_random_uuid(),
  participant_id uuid references public.participants (id) on delete set null,
  to_email       text not null,
  subject        text not null,
  provider_id    text,
  status         text not null default 'queued',
  error_message  text,
  created_at     timestamptz not null default now()
);

-- ------------------------------------------------------------
-- voice_prompts — prompt audio/text per language
-- ------------------------------------------------------------
create table public.voice_prompts (
  id          uuid primary key default gen_random_uuid(),
  lottery_id  uuid references public.lotteries (id) on delete cascade,
  slot        text not null,   -- welcome_greeting, lottery_explanation, ...
  language    text not null default 'en',
  text_content text,
  audio_url   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (lottery_id, slot, language)
);

-- ------------------------------------------------------------
-- audit_logs — immutable action log
-- ------------------------------------------------------------
create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  event       text not null,   -- PARTICIPANT_REGISTERED, PAYMENT_CAPTURED, ...
  actor_id    uuid,            -- admin user id, or null for system/voice
  actor_type  text not null default 'system', -- admin | system | voice | web
  lottery_id  uuid,
  entity_type text,
  entity_id   uuid,
  data        jsonb not null default '{}'::jsonb,
  ip_address  text,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- settings — global key-value config
-- ------------------------------------------------------------
create table public.settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_by  uuid references auth.users (id),
  updated_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- activity_logs — admin activity trail
-- ------------------------------------------------------------
create table public.activity_logs (
  id         uuid primary key default gen_random_uuid(),
  admin_id   uuid references auth.users (id) on delete set null,
  action     text not null,
  detail     text,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- webhook_logs — raw Sola / SignalWire webhook payloads
-- ------------------------------------------------------------
create table public.webhook_logs (
  id            uuid primary key default gen_random_uuid(),
  source        text not null,          -- sola | signalwire
  event_type    text,
  signature_valid boolean,
  payload       jsonb not null,
  processed     boolean not null default false,
  error_message text,
  created_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- rate_limits — per phone / IP throttle tracking
-- ------------------------------------------------------------
create table public.rate_limits (
  id         uuid primary key default gen_random_uuid(),
  scope      text not null,      -- 'phone' | 'ip'
  identifier text not null,      -- phone number or ip
  lottery_id uuid references public.lotteries (id) on delete cascade,
  window_start timestamptz not null default now(),
  count      integer not null default 1,
  unique (scope, identifier, lottery_id, window_start)
);

-- ------------------------------------------------------------
-- updated_at trigger helper
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'admins','lotteries','participants','payments',
    'call_logs','voice_prompts'
  ]
  loop
    execute format(
      'create trigger trg_%1$s_updated_at before update on public.%1$s
       for each row execute function public.set_updated_at();', t);
  end loop;
end;
$$;
