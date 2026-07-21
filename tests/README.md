# Automated Tests

Critical-path coverage for the platform.

## Deno (Edge Function logic)

```bash
deno test --allow-all supabase/functions/tests/
```

- `laml.test.ts` — LaML/TwiML builder + XML escaping
- `sola.test.ts` — Sola webhook HMAC signature verification (accept/reject/tamper)
- `notifications.test.ts` — SMS/email template rendering

## SQL (database business logic)

Run against a local Supabase instance (`supabase start` first):

```bash
psql "postgresql://postgres:postgres@localhost:54322/postgres" -f tests/ticket_assignment.test.sql
```

Verifies:
- ticket_number == dollar charge coupling
- `UNIQUE(lottery_id, ticket_number)` prevents duplicates
- sold-out guard (assignment never exceeds the range)
- `draw_winner` only selects captured tickets

## Frontend (Vitest)

```bash
npm --prefix frontend run test
```

## Concurrency stress (recommended)

To validate ticket uniqueness under load, fire N concurrent
`assign_ticket_and_record_payment` calls for a small range and assert exactly
`range_size` succeed with no duplicate `ticket_number`. The `UNIQUE` constraint
plus retry loop guarantees correctness; the serializable transaction guarantees
the sold-out count is consistent.
