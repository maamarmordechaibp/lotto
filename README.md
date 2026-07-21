# Voice-First Lottery Platform

Production-ready, voice-first lottery platform. The **primary** registration
channel is the **telephone** (SignalWire); the **website** is a secondary
channel that uses the **identical** backend API. All critical business logic
lives on the backend in **Supabase Edge Functions** — never in React.

> Core rule: when a caller enters, the backend randomly selects an **unused
> integer** within the lottery's charge range. That integer is **both** the
> ticket number **and** the exact dollar amount charged. Ticket `#247` → charge
> `$247`.

---

## Monorepo layout

```
.
├── frontend/            React 18 + Vite + TypeScript + Tailwind + shadcn/ui
├── supabase/
│   ├── functions/       Deno Edge Functions (business logic)
│   │   └── _shared/     Repositories, PaymentGateway, SignalWire, notifications
│   ├── migrations/      SQL schema + RLS + stored procedures + indexes
│   └── seed/            Dev seed data
├── docs/                API, schema, SignalWire, Sola, deployment guides
├── tests/               Automated tests for critical paths
└── .env.example         All required environment variables
```

## Architecture layers

| Layer         | Technology                                            |
| ------------- | ----------------------------------------------------- |
| UI            | React + shadcn/ui + TailwindCSS                       |
| State         | TanStack Query v5                                     |
| Validation    | Zod                                                   |
| Business      | Supabase Edge Functions (Deno)                        |
| Data          | Supabase PostgreSQL (RLS)                             |
| Telephony     | SignalWire Voice + Messaging                          |
| Payments      | `SolaPaymentsGateway implements PaymentGateway`       |
| Notifications | SMS (SignalWire) + Email                              |

## Payment abstraction

Every payment operation goes through the [`PaymentGateway`](supabase/functions/_shared/payment/gateway.ts)
interface. `SolaPaymentsGateway` is the default implementation. Swapping
providers requires **zero** changes to business logic — implement the interface
and change one factory line.

## Quick start (local)

```bash
# 1. Install root + frontend deps
npm install
npm --prefix frontend install

# 2. Configure environment
cp .env.example .env
cp .env.example frontend/.env   # then prefix web vars with VITE_

# 3. Start Supabase locally (requires Supabase CLI + Docker)
supabase start
supabase db reset               # applies migrations + seed

# 4. Serve Edge Functions
supabase functions serve --env-file ./supabase/functions/.env

# 5. Run the frontend
npm --prefix frontend run dev
```

## Documentation

- [docs/API.md](docs/API.md) — Edge Function API reference
- [docs/SCHEMA.md](docs/SCHEMA.md) — Database schema + ERD
- [docs/SIGNALWIRE.md](docs/SIGNALWIRE.md) — Call flow diagrams
- [docs/SOLA_PAYMENTS.md](docs/SOLA_PAYMENTS.md) — Sola integration + webhooks
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — Production deployment

## Testing

```bash
npm test                        # runs Deno + Vitest critical-path suites
```

Critical paths covered: ticket-assignment uniqueness under concurrency,
auth→capture→void flow, Sola webhook signature verification, phone registration
(mock SignalWire), RBAC, lottery status transitions, drawing selection.

## Security highlights

- RLS enabled on **all** tables.
- Service role key used **only** inside Edge Functions.
- Sola + SignalWire secrets stored **only** in Edge Function secrets.
- Webhook signature verification (Sola + SignalWire).
- Rate limiting per phone + IP; duplicate-phone detection per lottery.
- Immutable `audit_logs` for every critical action.
