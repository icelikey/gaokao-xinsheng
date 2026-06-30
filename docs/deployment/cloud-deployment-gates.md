# Cloud Deployment Gates

## Current Cloud Readiness

The repository is ready for a guarded dev/staging setup, but production deployment is still blocked until the user confirms external account actions.

Local evidence:

- `pnpm verify` covers lint, typecheck, AI hint golden tests, grading golden tests, runtime secret-boundary checks, store-backend fail-closed checks, Supabase contract checks, miniprogram contract checks and Next build.
- Supabase migrations define the core tables, private-table RLS enablement, `grading_jobs` queue bridge and `review_queue` view.
- Supabase config defines the `share-cards` storage bucket for rendered poster images.
- Server-side Supabase adapter code exists but is gated by `SUPABASE_STORE_ADAPTER_ENABLED=true`.
- The miniprogram scaffold calls service APIs only and does not include secret-like patterns.

## Human Confirmation Required

Do not perform these actions without explicit user confirmation:

- create or connect a GitHub remote
- commit, push or open a pull request
- create or link Vercel projects
- add Vercel environment variables
- create or link Supabase projects
- run migrations against a hosted Supabase project
- upload a WeChat experience version
- enter production credentials or paid resources

## GitHub Gate

Required before Vercel Preview can be considered verified:

- repository exists on GitHub
- default branch is confirmed
- `.github/workflows/ci.yml` runs `pnpm verify`
- PR or branch Preview URL is visible in GitHub/Vercel checks

Evidence to record:

- GitHub repository URL
- branch name
- CI run URL
- PR Preview URL

## Vercel Gate

Required before miniprogram staging uses a real HTTPS API:

- GitHub repository connected to Vercel
- Vercel project Root Directory set to `apps/web`
- Vercel project uses `apps/web/vercel.json`
- monorepo workspace install/build commands confirmed
- server-only variables added outside `NEXT_PUBLIC_*`
- Preview deployment returns `200` from `/api/health`
- Preview deployment serves `/api/v1/papers/paper_2010_sd_math_sci_mvp` without `answer` or `rubric`

Evidence to record:

- Vercel project URL
- Preview deployment URL
- Vercel Root Directory screenshot or project settings export
- health response
- public paper no-answer smoke result

## Supabase Gate

Required before replacing local memory with hosted persistence:

- Supabase dev project exists
- migrations run in order:
  - `202606290001_initial_schema.sql`
  - `202606290002_cloud_runtime_contracts.sql`
  - `202606290003_share_card_idempotency.sql`
  - `202606290004_paper_mapping_rules.sql`
- `grading_jobs` queue exists
- `paper_mapping_rules` contains the MVP mapping seed
- `share-cards` storage bucket exists
- private tables have RLS enabled
- no direct anon/auth grants are added for exam writes
- server-side adapter smoke test passes with `SUPABASE_STORE_ADAPTER_ENABLED=true`

Optional hosted smoke command after the dev project is ready:

```powershell
$env:SUPABASE_HOSTED_SMOKE="1"
$env:EXAM_STORE_BACKEND="supabase"
$env:SUPABASE_STORE_ADAPTER_ENABLED="true"
$env:SUPABASE_URL="<dev project url>"
$env:SUPABASE_SERVICE_ROLE_KEY="<service role key>"
pnpm test:supabase-hosted-smoke
```

This command writes dev smoke rows through the app store facade. It must stay outside default `pnpm verify`.

Evidence to record:

- Supabase project ref
- migration history
- sampled table list
- paper mapping seed check
- queue existence check
- bucket existence check
- RLS check
- hosted smoke output with `sessionId`, `reportId`, `gradingJobId` and `shareCardId`

## WeChat Gate

Required before M7 can be marked complete:

- `apps/miniprogram` imports in WeChat DevTools
- `appid` is replaced with the real appid
- `apiBaseUrl` and `shareWebBaseUrl` use Vercel HTTPS
- URL check is enabled for staging
- request domain is configured in WeChat platform
- privacy prompt and AI disclosure copy are reviewed
- real-device flow screenshots are captured

Evidence to record:

- DevTools screenshot
- real-device screenshots
- legal domain settings screenshot
- weak-network/resume test notes

## Official References Checked

Checked on 2026-06-29:

- Vercel Project Configuration: https://vercel.com/docs/project-configuration
- Vercel Monorepos: https://vercel.com/docs/monorepos
- Supabase Queues: https://supabase.com/docs/guides/queues
- Supabase Storage: https://supabase.com/docs/guides/storage
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Vercel environment variables: https://vercel.com/docs/environment-variables
- Vercel Git deployments: https://vercel.com/docs/deployments/git
- WeChat miniprogram network: https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html
