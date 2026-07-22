-- ============================================================
-- 0007_fix_assign_ambiguous.sql
-- Fix: "column reference ticket_number is ambiguous" in
-- assign_ticket_and_record_payment. The RETURNING clause referenced
-- ticket_number, which collides with the function's RETURNS TABLE
-- output column of the same name. Adding #variable_conflict use_column
-- makes ambiguous identifiers resolve to the table column.
-- ============================================================

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
#variable_conflict use_column
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
      returning participants.id, participants.ticket_number into v_participant, v_assigned;

      exit;
    exception when unique_violation then
      v_participant := null;
    end;
  end loop;

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
    returning participants.id, participants.ticket_number into v_participant, v_assigned;
  end if;

  insert into public.payments (
    participant_id, lottery_id, gateway, gateway_reference,
    session_id, auth_id, status, authorized_cents, amount_cents,
    currency, raw_response
  ) values (
    v_participant, p_lottery_id, p_gateway, p_gateway_reference,
    p_session_id, p_auth_id, 'captured', p_authorized_cents, v_assigned * 100,
    'USD', p_raw_response
  )
  returning payments.id into v_payment;

  if (v_used_count + 1) >= v_range_size then
    update public.lotteries
      set status = 'closed', updated_at = now()
    where id = p_lottery_id and status = 'open';
  end if;

  return query select v_participant, v_assigned, v_assigned * 100, v_payment;
end;
$$;
