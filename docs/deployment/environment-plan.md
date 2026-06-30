# Environment Plan

## Environments

| Environment | Purpose | Owner Action |
| --- | --- | --- |
| local | UI flow checks, mock data, design review | No production secrets |
| dev | Daily cloud integration | Auto deploy from development branch |
| staging | Mini-program review, real-domain test, AI golden set | Manual promotion gate |
| prod | Real users | Manual confirmation required |

## Vercel

- Connect the GitHub repository to Vercel.
- Set the Vercel project Root Directory to `apps/web`.
- Use `apps/web/vercel.json` as the project-level Vercel configuration.
- Use Preview deployments for pull requests and feature branches.
- Scope environment variables by `development`, `preview`, and `production`.
- Keep server-only keys out of `NEXT_PUBLIC_*`.

Required variables:

```text
NEXT_PUBLIC_APP_ENV
APP_BASE_URL
EXAM_STORE_BACKEND
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
AI_PROVIDER_API_KEY
WECHAT_APP_ID
WECHAT_APP_SECRET
```

Only add `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` if a future feature intentionally uses Supabase client-side access. The current MVP keeps all core writes behind server APIs.

Default local storage mode:

```text
EXAM_STORE_BACKEND=memory
```

Hosted persistence mode:

```text
EXAM_STORE_BACKEND=supabase
```

## Supabase

- Manage schema changes through `supabase/migrations`.
- Use separate projects for `dev`, `staging`, and `prod` unless Supabase Branching is adopted.
- Enable RLS on user-facing tables before any direct client access.
- Prefer service-role access only inside server APIs and Edge Functions.
- Use the `grading_jobs` queue for grading jobs.
- Use the `share-cards` storage bucket for rendered poster images.
- Keep `supabase/functions/grading-worker` as a guarded Edge Function stub until hosted queue consumption is explicitly wired.

## WeChat Mini Program

- Mini program calls the service API only.
- Configure legal request/upload/download domains before formal review.
- Production API domains must use valid HTTPS certificates and meet platform requirements.
- Do not put AI provider keys, Supabase service keys or WeChat AppSecret in mini-program code.

## Promotion Gates

1. Local build passes.
2. Preview flow is visually reviewed.
3. Migration is reviewed and reversible by forward-compatible migration.
4. Staging golden tests pass.
5. Human confirmation before production deploy.
