# Deployment Guide

End-to-end production deployment: Supabase (DB + Edge Functions), the React
frontend on Cloudflare Pages, and provider webhooks.

## Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Node.js 18+
- A Supabase project, a SignalWire space, a Sola merchant account
- A Cloudflare account with the domain `codelabsus.com`

---

## 1. Supabase — database + functions

```bash
# Log in with a personal access token (sbp_...)
export SUPABASE_ACCESS_TOKEN=sbp_xxx
supabase link --project-ref <project-ref>

# Push migrations (schema, RLS, functions, storage, realtime)
supabase db push

# Seed (dev only — skip in production)
# supabase db reset

# Set Edge Function secrets
supabase secrets set --env-file ./supabase/functions/.env

# Deploy all Edge Functions
supabase functions deploy enter-lottery
supabase functions deploy sola-webhook
supabase functions deploy signalwire-voice
supabase functions deploy draw-winner
supabase functions deploy refund-payment
```

> Get the real `service_role` JWT from **Dashboard → Project Settings → API**
> and put it in `supabase/functions/.env` before setting secrets. The `sbp_`
> token is a CLI/management token, **not** the service role key.

### Create the first admin

Sign up a user (Dashboard → Authentication), then:
```sql
insert into public.admins (id, email, full_name) values ('<uid>', '<email>', 'Admin');
insert into public.user_roles (user_id, role) values ('<uid>', 'super_admin');
```

---

## 2. Frontend — Cloudflare Pages (`lotto.codelabsus.com`)

Build settings:
- **Build command:** `npm install && npm run build`
- **Build output directory:** `frontend/dist`
- **Root directory:** `/` (repo root)

Environment variables (Pages → Settings → Environment):
```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon/publishable key>
VITE_APP_URL=https://lotto.codelabsus.com
```

### Deploy with Wrangler

```bash
npm --prefix frontend install
npm --prefix frontend run build
npx wrangler pages deploy frontend/dist --project-name lotto
```

### Custom subdomain

Cloudflare → Pages → your project → **Custom domains** → add
`lotto.codelabsus.com`. Cloudflare auto-creates the CNAME since the zone
`codelabsus.com` is on the same account.

---

## 3. Provider webhooks

| Provider | URL |
| --- | --- |
| SignalWire (Voice) | `https://<ref>.supabase.co/functions/v1/signalwire-voice` |
| Sola (payments) | `https://<ref>.supabase.co/functions/v1/sola-webhook` |

---

## 4. Post-deploy checklist

- [ ] `service_role` key set in function secrets (not the `sbp_` token)
- [ ] Sola in `production` mode with real keys
- [ ] SignalWire number points to the voice function
- [ ] Sola webhook secret configured + signature verified
- [ ] RLS verified (anon cannot read `participants`/`payments`)
- [ ] First `super_admin` created
- [ ] Rotate any secrets that were shared in plaintext
- [ ] Run `npm test` (critical-path suites) green
