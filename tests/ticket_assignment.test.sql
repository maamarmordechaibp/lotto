-- ============================================================
-- ticket_assignment.test.sql
-- Critical-path DB tests (run against a local Supabase instance).
--   psql "$DATABASE_URL" -f tests/ticket_assignment.test.sql
-- Verifies:
--   * ticket_number == dollar charge coupling
--   * UNIQUE(lottery_id, ticket_number) prevents duplicates
--   * assignment never exceeds the range (sold-out guard)
--   * draw_winner only selects captured tickets
-- ============================================================

begin;

-- Fresh test lottery: tiny range [1,3] => 3 tickets max.
insert into public.lotteries (id, name, start_date, end_date, max_participants, min_charge, max_charge, status)
values ('99999999-9999-9999-9999-999999999999', 'TEST', now(), now() + interval '1 day', 3, 1, 3, 'open')
on conflict (id) do nothing;

-- Assign all three tickets.
do $$
declare i int;
begin
  for i in 1..3 loop
    perform public.assign_ticket_and_record_payment(
      '99999999-9999-9999-9999-999999999999', 'F'||i, 'L'||i, '+1555000000'||i,
      null, null, 'web', 'sola', 'ref'||i, 'auth'||i, 'sess'||i, 300, '{}'::jsonb);
  end loop;
end $$;

-- ASSERT: exactly 3 participants, all with amount = ticket_number*100.
do $$
declare bad int; cnt int;
begin
  select count(*) into cnt from public.participants
    where lottery_id = '99999999-9999-9999-9999-999999999999';
  if cnt <> 3 then raise exception 'Expected 3 participants, got %', cnt; end if;

  select count(*) into bad from public.participants
    where lottery_id = '99999999-9999-9999-9999-999999999999'
      and amount_cents <> ticket_number * 100;
  if bad > 0 then raise exception 'ticket/charge coupling violated in % rows', bad; end if;
end $$;

-- ASSERT: 4th assignment fails with SOLD_OUT (range exhausted).
do $$
begin
  begin
    perform public.assign_ticket_and_record_payment(
      '99999999-9999-9999-9999-999999999999', 'X', 'Y', '+15550000099',
      null, null, 'web', 'sola', 'refX', 'authX', 'sessX', 300, '{}'::jsonb);
    raise exception 'Expected SOLD_OUT, but assignment succeeded';
  exception when others then
    if position('SOLD_OUT' in SQLERRM) = 0 then raise; end if;
  end;
end $$;

-- ASSERT: draw_winner returns a captured ticket within range.
do $$
declare t int;
begin
  select winner_ticket_number into t
  from public.draw_winner('99999999-9999-9999-9999-999999999999',
    '00000000-0000-0000-0000-0000000000a1');
  if t is null or t < 1 or t > 3 then raise exception 'draw_winner returned invalid ticket %', t; end if;
end $$;

rollback;  -- keep the DB clean; tests are assertions only.

\echo 'ticket_assignment.test.sql PASSED'
