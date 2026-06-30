# Runtime Storage Contract

## Current Mode

The local MVP currently runs with:

```text
EXAM_STORE_BACKEND=memory
```

This mode is for flow, UI and contract confirmation only. Data is reset when the Next.js process restarts.

## Cloud Mode

Cloud persistence must use:

```text
EXAM_STORE_BACKEND=supabase
SUPABASE_STORE_ADAPTER_ENABLED=true
SUPABASE_URL=<server-side Supabase project URL>
SUPABASE_SERVICE_ROLE_KEY=<server-only service role key>
```

The miniprogram and browser must still call only the service API. They must not receive Supabase service-role credentials, AI provider keys or WeChat AppSecret.

## Safe Public Environment Variables

Allowed by default:

```text
NEXT_PUBLIC_APP_ENV
```

Not allowed by default:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Those public Supabase values should be introduced only if a future feature deliberately uses direct client-side Supabase reads and has a separate RLS review.

## Health Endpoint

`GET /api/health` returns only safe runtime status:

```json
{
  "service": "gaokao-xinsheng-web",
  "status": "ok",
  "environment": "development",
  "storage": "memory",
  "missing": []
}
```

If `EXAM_STORE_BACKEND=supabase` is selected without required server variables, the endpoint reports `configuration_incomplete` and names missing variable keys without exposing values.

The Supabase adapter exists in code but is gated. Until it is explicitly enabled and proven against a hosted dev project, Supabase mode reports `SUPABASE_STORE_ADAPTER_ENABLED` as missing and store operations return:

```json
{
  "code": "SUPABASE_STORE_ADAPTER_PENDING"
}
```

## Verification

`pnpm test:runtime-contract` checks:

- `.env.example` defaults to memory storage.
- `.env.example` keeps `SUPABASE_STORE_ADAPTER_ENABLED=false`.
- Supabase service credentials are server-only placeholders.
- `NEXT_PUBLIC_SUPABASE_*` is not present by default.
- health route uses safe runtime readiness.
- API routes use `exam-store-backend` instead of direct memory-store imports.
- Supabase adapter persists sessions, answer versions, AI events, grading results, reports and share-card idempotency through server-side REST/RPC code.
- Share-card creation renders a 1080x1440 PNG poster, uploads it to the `share-cards` Storage bucket in Supabase mode and stores `share_cards.object_url`.
- miniprogram source does not include secret-like Supabase, AI or WeChat variables.

`pnpm test:deployment-contract` checks:

- GitHub Actions uses Node 22, pnpm and `pnpm verify`.
- Vercel project configuration is scoped to `apps/web` and does not store env secrets in the repo.
- Supabase Edge Runtime and the guarded `grading-worker` function stub exist.
- local `.vercel/` metadata remains ignored.

`pnpm test:store-backend` checks:

- memory backend can create a local exam session
- memory backend can generate a local PNG poster data URL for share preview
- Supabase backend fails closed with `SUPABASE_STORE_ADAPTER_PENDING`

`pnpm test:supabase-hosted-smoke` is optional and not part of default `pnpm verify`.

- Without `SUPABASE_HOSTED_SMOKE=1`, it exits successfully with `skipped: true`.
- With a hosted dev Supabase project and complete server-only env, it creates a session, saves answers, persists an AI help event, submits grading, uploads a share poster, creates an idempotent share card and checks the public share payload for private answers.
- It writes dev smoke rows and must not be run against production.

## Cutover Rule

Do not switch `EXAM_STORE_BACKEND=supabase` in Vercel until:

- hosted Supabase dev migrations have run successfully
- RLS state has been inspected
- `grading_jobs` queue exists
- `share-cards` bucket exists
- server-side Supabase adapter has a passing API smoke test
- optional hosted smoke has passed against the dev Supabase project
- `SUPABASE_STORE_ADAPTER_ENABLED=true` is set only in the Vercel environment used for that smoke test
- Vercel Preview health returns `storage: "supabase"` and `status: "ok"`
