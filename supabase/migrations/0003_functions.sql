-- ============================================================
-- 0003_functions.sql
-- Core business-logic stored procedures.
--   * Role helpers used by RLS.
--   * Atomic ticket assignment (ticket_number == dollar charge).
--   * Winner drawing (never selects an unsold ticket).
--   * Dashboard aggregate stats.
-- ============================================================

-- ------------------------------------------------------------
-- Role helpers (SECURITY DEFINER so RLS policies can call them
-- without recursive RLS on user_roles).
-- ------------------------------------------------------------
create or replace function public.has_role(uid uuid, required app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = uid and ur.role = required
  );
$$;

create or replace function public.has_any_role(uid uuid, required app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = uid and ur.role = any(required)
  );
$$;

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles ur where ur.user_id = uid);
$$;

-- ------------------------------------------------------------
-- assign_ticket_and_record_payment
-- Atomically:
--   1. Verify lottery is OPEN and not sold out.
--   2. Select an UNUSED random integer in [min_charge, max_charge].
--   3. Insert participant (ticket_number == dollar charge).
--   4. Insert/attach payment row (captured).
-- The caller MUST run this inside a SERIALIZABLE transaction.
-- The UNIQUE(lottery_id, ticket_number) constraint guarantees no
-- double assignment even under concurrency; we retry on conflict.
-- Returns the created participant + ticket details.
-- ------------------------------------------------------------
create or replace function public.assign_ticket_and_record_payment(
  p_lottery_id      uuid,
  p_first_name      text,
  p_last_name       text,
  p_phone           text,
  p_email           text,
  p_address         text,
  p_channel         entry_channel,
  p_gateway         text,
  p_gateway_reference text,
  p_auth_id         text,
  p_session_id      text,
  p_authorized_cents integer,
  p_raw_response    jsonb default '{}'::jsonb
)
returns table (
  participant_id uuid,
  ticket_number  integer,
  amount_cents   integer,
  payment_id     uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_min          integer;
  v_max          integer;
  v_status       lottery_status;
  v_assigned     integer;
  v_used_count   integer;
  v_range_size   integer;
  v_candidate    integer;
  v_attempts     integer := 0;
  v_max_attempts constant integer := 50;
  v_participant  uuid;
  v_payment      uuid;
begin
  -- Lock the lottery row to serialize sold-out checks.
  select min_charge, max_charge, status
    into v_min, v_max, v_status
  from public.lotteries
  where id = p_lottery_id and deleted_at is null
  for update;

  if not found then
    raise exception 'LOTTERY_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_status <> 'open' then
    raise exception 'LOTTERY_NOT_OPEN' using errcode = 'P0001';
  end if;

  v_range_size := v_max - v_min + 1;

  select count(*) into v_used_count
  from public.participants
  where lottery_id = p_lottery_id and deleted_at is null;

  if v_used_count >= v_range_size then
    raise exception 'LOTTERY_SOLD_OUT' using errcode = 'P0003';
  end if;

  -- Try random candidates first (fast path for sparse ranges).
  while v_attempts < v_max_attempts loop
    v_attempts := v_attempts + 1;
    v_candidate := v_min + floor(random() * v_range_size)::int;

    begin
      insert into public.participants (
        lottery_id, ticket_number, amount_cents,
        first_name, last_name, phone, email, address,
        channel, payment_status, payment_reference
      ) values (
        p_lottery_id, v_candidate, v_candidate * 100,
        p_first_name, p_last_name, p_phone, p_email, p_address,
        p_channel, 'captured', p_gateway_reference
      )
      returning id, ticket_number into v_participant, v_assigned;

      exit; -- success
    exception when unique_violation then
      v_participant := null; -- collision, retry
    end;
  end loop;

  -- Deterministic fallback: pick the smallest unused number in range.
  if v_participant is null then
    select gs into v_candidate
    from generate_series(v_min, v_max) as gs
    where not exists (
      select 1 from public.participants p
      where p.lottery_id = p_lottery_id
        and p.ticket_number = gs
        and p.deleted_at is null
    )
    order by random()
    limit 1;

    if v_candidate is null then
      raise exception 'LOTTERY_SOLD_OUT' using errcode = 'P0003';
    end if;

    insert into public.participants (
      lottery_id, ticket_number, amount_cents,
      first_name, last_name, phone, email, address,
      channel, payment_status, payment_reference
    ) values (
      p_lottery_id, v_candidate, v_candidate * 100,
      p_first_name, p_last_name, p_phone, p_email, p_address,
      p_channel, 'captured', p_gateway_reference
    )
    returning id, ticket_number into v_participant, v_assigned;
  end if;

  -- Record the payment (captured exactly the ticket amount).
  insert into public.payments (
    participant_id, lottery_id, gateway, gateway_reference,
    session_id, auth_id, status, authorized_cents, amount_cents,
    currency, raw_response
  ) values (
    v_participant, p_lottery_id, p_gateway, p_gateway_reference,
    p_session_id, p_auth_id, 'captured', p_authorized_cents, v_assigned * 100,
    'USD', p_raw_response
  )
  returning id into v_payment;

  -- Auto-complete lottery when the final ticket is assigned.
  if (v_used_count + 1) >= v_range_size then
    update public.lotteries
      set status = 'closed', updated_at = now()
    where id = p_lottery_id and status = 'open';
  end if;

  return query select v_participant, v_assigned, v_assigned * 100, v_payment;
end;
$$;

-- ------------------------------------------------------------
-- draw_winner — randomly select one SOLD (captured) ticket.
-- Never selects an unassigned ticket. Records the drawing.
-- ------------------------------------------------------------
create or replace function public.draw_winner(
  p_lottery_id uuid,
  p_drawn_by   uuid
)
returns table (
  drawing_id     uuid,
  participant_id uuid,
  ticket_number  integer,
  amount_cents   integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant uuid;
  v_ticket      integer;
  v_amount      integer;
  v_drawing     uuid;
begin
  -- Lock the lottery so only one drawing can run at a time.
  perform 1 from public.lotteries where id = p_lottery_id for update;

  if exists (select 1 from public.drawings where lottery_id = p_lottery_id) then
    raise exception 'DRAWING_ALREADY_EXISTS' using errcode = 'P0004';
  end if;

  select p.id, p.ticket_number, p.amount_cents
    into v_participant, v_ticket, v_amount
  from public.participants p
  where p.lottery_id = p_lottery_id
    and p.deleted_at is null
    and p.payment_status = 'captured'
  order by random()
  limit 1;

  if v_participant is null then
    raise exception 'NO_ELIGIBLE_TICKETS' using errcode = 'P0005';
  end if;

  insert into public.drawings (
    lottery_id, participant_id, winner_ticket_number, amount_cents, drawn_by
  ) values (
    p_lottery_id, v_participant, v_ticket, v_amount, p_drawn_by
  )
  returning id into v_drawing;

  update public.lotteries
    set status = 'completed', updated_at = now()
  where id = p_lottery_id;

  return query select v_drawing, v_participant, v_ticket, v_amount;
end;
$$;

-- ------------------------------------------------------------
-- lottery_stats — aggregate dashboard metrics for a lottery.
-- ------------------------------------------------------------
create or replace function public.lottery_stats(p_lottery_id uuid)
returns table (
  total_revenue_cents bigint,
  total_participants  bigint,
  remaining_tickets   bigint,
  average_charge_cents numeric,
  highest_charge_cents integer,
  lowest_charge_cents  integer,
  phone_count         bigint,
  web_count           bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with l as (
    select max_charge - min_charge + 1 as range_size
    from public.lotteries where id = p_lottery_id
  ),
  p as (
    select * from public.participants
    where lottery_id = p_lottery_id and deleted_at is null
      and payment_status = 'captured'
  )
  select
    coalesce(sum(p.amount_cents), 0)::bigint,
    count(p.*)::bigint,
    (select range_size from l) - count(p.*),
    coalesce(avg(p.amount_cents), 0),
    coalesce(max(p.amount_cents), 0),
    coalesce(min(p.amount_cents), 0),
    count(*) filter (where p.channel = 'phone')::bigint,
    count(*) filter (where p.channel = 'web')::bigint
  from p;
$$;
