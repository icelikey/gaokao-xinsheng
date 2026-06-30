# Cloud Readiness Verification Log

## Scope

Non-production cloud contract readiness for GitHub, Vercel and Supabase.

## Current Status

Partially verified locally on 2026-06-29.

No hosted GitHub/Vercel/Supabase project was created or modified in this pass. The work only added repository-level contracts and static checks so a future confirmed cloud setup has a safer runway.

## Supabase Evidence

- Migration files:
  - `supabase/migrations/202606290001_initial_schema.sql`
  - `supabase/migrations/202606290002_cloud_runtime_contracts.sql`
  - `supabase/migrations/202606290003_share_card_idempotency.sql`
  - `supabase/migrations/202606290004_paper_mapping_rules.sql`
  - `supabase/migrations/202606290005_review_workflow.sql`
  - `supabase/migrations/202606290006_paper_import_batches.sql`
- Required core tables are present in migrations:
  - users, profiles, papers, paper mapping rules, sections, questions, answer keys, rubrics
  - exam sessions, answer versions, AI help events
  - grading jobs, grading results, reports, share cards
  - paper import batches
  - review tasks
  - model configs, prompt versions, audit logs
- Private tables have RLS enabled.
- `pgmq` queue contract exists for `grading_jobs`.
- `public.enqueue_grading_job(uuid, uuid)` is granted to `service_role` only.
- `public.review_queue` view exists for operations.
- `share-cards` storage bucket is declared in `supabase/config.toml`.
- `share_cards.idempotency_key` and `idx_share_cards_report_idempotency` exist for share-card idempotency.
- `paper_mapping_rules` and `idx_paper_mapping_rules_lookup` exist for cohort-to-paper matching.
- `paper_import_batches` exists for admin import dry-run/accepted batch evidence, including `conflict_policy` and `commit_summary`.
- Supabase seed scores now match the current 150-point fixture: choice 70, fill-blank 40, free-response 40.
- `review_tasks` exists for assigned/resolved/rejected reviewer workflow state.
- `review_queue` exposes workflow status and audit counts while excluding terminal review items.

## Static Check Result

`pnpm test:supabase-contract` result:

```json
{
  "ok": true,
  "migrations": 6,
  "requiredTables": 20,
  "rlsTables": 11,
  "hasPaperMappingRules": true,
  "hasQueue": true,
  "hasShareBucket": true,
  "hasShareIdempotency": true,
  "hasPaperImportBatches": true,
  "hasPaperImportCommit": true,
  "hasSharePosterUpload": true,
  "hasHostedSmokeScript": true,
  "hostedSmokeInDefaultVerify": false,
  "directClientGrants": 0
}
```

## Full Verification

`pnpm verify` now includes:

- web lint
- contracts, ai-tutor, grader and web typecheck
- AI hint golden-set leak check
- grading golden-set check
- catalog match contract check
- runtime secret-boundary check
- report/share contract check
- share edge-case poster and mobile CSS check
- review workflow contract check
- paper import contract check
- deployment contract check
- PRD traceability check
- store-backend fail-closed check
- Supabase contract check
- miniprogram contract check
- Next build

## Runtime Contract Check Result

`pnpm test:runtime-contract` result:

```json
{
  "ok": true,
  "envDefaults": {
    "publicSupabase": false,
    "storeBackend": "memory",
    "supabaseAdapterEnabled": false,
    "serverSupabaseUrl": true
  },
  "healthExposesSecrets": false,
  "supabaseAdapterPresent": true,
  "apiRoutesUseBackendFacade": true,
  "miniprogramSecretPatterns": 0
}
```

## Catalog Contract Check Result

`pnpm test:catalog-contract` result:

```json
{
  "ok": true,
  "years": 1,
  "regions": 1,
  "candidateCount": 1,
  "autoSelectedPaperId": "paper_2010_sd_math_sci_mvp",
  "noAnswerLeak": true,
  "unknownRegionMatches": 0
}
```

## Deployment Contract Check Result

`pnpm test:deployment-contract` result:

```json
{
  "ok": true,
  "ciRunsVerify": true,
  "vercelProjectRoot": "apps/web",
  "vercelFramework": "nextjs",
  "vercelBuildCommand": "pnpm build",
  "vercelEnvInRepo": false,
  "supabaseEdgeRuntime": true,
  "gradingWorkerStub": true
}
```

## Report Contract Check Result

`pnpm test:report-contract` result:

```json
{
  "ok": true,
  "hasReportMistakesRoute": true,
  "mistakeFilter": "score-or-review",
  "posterBitmapContract": "1080x1440-png",
  "publicSharePrivateFields": false,
  "hasShareVisibilityControls": true,
  "allowedPublicShareFields": 10
}
```

## Share Edge-Case Check Result

`pnpm test:share-edge-cases` result:

```json
{
  "ok": true,
  "edgeCases": 4,
  "samplePoster": {
    "file": "output/share-poster-sample.png",
    "width": 1080,
    "height": 1440
  },
  "mobileShareViewportCss": true
}
```

## Review Workflow Contract Check Result

`pnpm test:review-workflow` result:

```json
{
  "ok": true,
  "hasReviewActionRoute": true,
  "hasReviewTasksMigration": true,
  "hasReviewAuditLogs": true,
  "hasScoreAdjustmentAudit": true,
  "terminalReviewsLeaveQueue": true,
  "directClientGrants": 0
}
```

## Paper Import Contract Check Result

`pnpm test:paper-import` result:

```json
{
  "ok": true,
  "validStatus": "VALIDATED",
  "rejectedStatus": "REJECTED",
  "importedStatus": "IMPORTED",
  "questionCount": 30,
  "maxScoreSum": 150,
  "committedQuestionRows": 30,
  "directClientGrants": 0
}
```

## PRD Traceability Check Result

`pnpm test:prd-traceability` result:

```json
{
  "ok": true,
  "sourceShape": "239 paragraphs, 78 tables",
  "p0Rows": 7,
  "invariantRows": 7,
  "hasHostedGapList": true,
  "nextSlice": "hosted Supabase smoke and Vercel Preview evidence"
}
```

## Store Backend Check Result

`pnpm test:store-backend` result:

```json
{
  "ok": true,
  "memoryBackendCreatesSession": true,
  "memoryBackendKeepsPreAiSnapshot": true,
  "memoryBackendDualScoreDiff": 5,
  "memoryReviewWorkflowAudited": true,
  "memoryScoreAdjustmentAudited": true,
  "memoryReviewQueueRemovesResolved": true,
  "memorySharePosterPng": true,
  "memorySharePosterBytesPositive": true,
  "memoryShareVisibilityHidesScores": true,
  "memoryShareVisibilityHidesPaperAndRegion": true,
  "supabaseBackendFailsClosed": true,
  "supabasePendingCode": "SUPABASE_STORE_ADAPTER_PENDING"
}
```

## HTTP Store Guard Smoke Result

Temporary local server with `EXAM_STORE_BACKEND=supabase` on port `3001` returned:

```json
{
  "ok": true,
  "health": {
    "status": 200,
    "body": {
      "service": "gaokao-xinsheng-web",
      "status": "configuration_incomplete",
      "environment": "development",
      "storage": "supabase",
      "missing": [
        "SUPABASE_STORE_ADAPTER_ENABLED"
      ]
    }
  },
  "create": {
    "status": 501,
    "body": {
      "data": null,
      "error": {
        "code": "SUPABASE_STORE_ADAPTER_PENDING"
      }
    }
  }
}
```

Memory mode on port `3000` still returned `status: "ok"` and `storage: "memory"` after the guard smoke.

## Optional Hosted Supabase Smoke

`pnpm test:supabase-hosted-smoke` has been added for a future confirmed hosted dev project.

- Default behavior without `SUPABASE_HOSTED_SMOKE=1`: skips safely and does not write cloud data.
- Enabled behavior: requires `EXAM_STORE_BACKEND=supabase`, `SUPABASE_STORE_ADAPTER_ENABLED=true`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- Coverage: paper import commit, create session, start, save answers, AI help pre-answer snapshot, submit grading, grading job lookup, share-card idempotency, share visibility, Storage poster object URL, public share token lookup, review queue list, review assignment, manual score adjustment audit, review resolution and audit log write.
- Boundary: not included in default `pnpm verify` because it writes dev smoke rows.

Default skip result:

```json
{
  "ok": true,
  "skipped": true,
  "reason": "Set SUPABASE_HOSTED_SMOKE=1 with dev Supabase credentials to run the hosted write smoke test."
}
```

## Remaining Hosted Evidence

The following evidence is still missing and must not be claimed complete yet:

- GitHub repository URL and CI run URL
- Vercel Preview URL
- Supabase dev project ref
- hosted migration history
- hosted queue existence check
- hosted storage bucket existence check
- Vercel health evidence with `storage: "supabase"`
- hosted Supabase adapter smoke test with `SUPABASE_STORE_ADAPTER_ENABLED=true`
- WeChat DevTools import screenshot
- real-device miniprogram screenshots
