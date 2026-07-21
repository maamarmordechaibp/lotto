# Supabase deploy scripts (Management API)

These scripts deploy the database schema and Edge Functions using the Supabase
**Management API** over plain HTTPS. Use them when the `supabase` CLI cannot
reach the API (e.g. a corporate/content filter blocks the CLI's HTTP stack).

All scripts take the access token as a parameter — **never** hard-code it.

```powershell
# 1. Apply all migrations (+ optional seed)
./scripts/apply-migrations.ps1 -Token $env:SUPABASE_ACCESS_TOKEN -Ref <project-ref> -Dir supabase -Seed

# 2. Set Edge Function secrets from an env file (skips SUPABASE_* and PASTE_* placeholders)
./scripts/set-secrets.ps1 -Token $env:SUPABASE_ACCESS_TOKEN -Ref <project-ref> -EnvFile supabase/functions/.env

# 3. Deploy one Edge Function (repeat per slug)
./scripts/deploy-function.ps1 -Token $env:SUPABASE_ACCESS_TOKEN -Ref <project-ref> -FunctionsDir supabase/functions -Slug enter-lottery

# Or deploy everything at once:
./scripts/deploy-all.ps1 -Token $env:SUPABASE_ACCESS_TOKEN -Ref <project-ref>
```

Under normal networks, prefer the official CLI (see [../docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md)).
