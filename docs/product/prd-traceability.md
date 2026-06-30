# PRD Traceability Matrix

## Source Document

- Source file: `E:/video/ice/世界树/时间移民/偃月牵丝/高考新生小程序_产品与技术开发文档_v1.0.docx`
- Last modified: `2026-06-26 20:40:29`
- Extraction date: `2026-06-29`
- Extracted shape: 239 paragraphs, 78 tables

This matrix maps the source PRD into the current repository state. It is intentionally conservative: local proof does not count as hosted GitHub/Vercel/Supabase or WeChat real-device completion.

## PRD Baseline

Source highlights:

- Paragraphs 7-11 define the MVP scope: cohort selection, paper matching, pre-exam settings, online answer flow, four-level AI tutoring, autosave, submit, AI estimation, dual score report, wrong-question review, share poster, history and operations backend.
- Table 7 defines P0 capabilities: paper matching, math answering, four-level AI tutoring, AI estimation, dual report, wrong-question/share flow and operations backend.
- Paragraphs 43-51 and 68-77 define hard exam invariants: pre-AI answer snapshot, submitted answer version, server-authoritative state and submit idempotency.
- Paragraphs 79-93 define AI tutoring boundaries: user-initiated AI, low-level hint no-leak rules, model/prompt traceability and fallback.
- Paragraphs 94-115 define grading: deterministic objective grading, symbolic equivalence, rubric evidence, confidence and manual review.
- Paragraphs 116-130 define report/share privacy: allowed public fields only, no raw answer or hidden personal fields in public share.
- Tables 60-62 define privacy, AI explanation, AI content marking and score disclaimer requirements.
- Tables 68-69 define verification coverage: unit, contract, integration, AI golden set, real-device, performance, security and review rehearsal.

## P0 Traceability

| ID | PRD requirement | Current repository evidence | Status | Next proof needed |
| --- | --- | --- | --- | --- |
| P0-01 | Select cohort/profile and match the most likely paper by year, region, track and subject. | Shared catalog contract, v1 years/regions/match APIs, Web selection flow, miniprogram selection flow and `paper_mapping_rules` migration/seed exist. `pnpm test:catalog-contract` proves 2010届山东理科数学 maps to the MVP paper and unknown regions do not match. | Repo-proven local | Prove the same flow in WeChat DevTools/real device and hosted Supabase mapping table. |
| P0-02 | Math online answering with autosave, resume and answer card. | Web exam flow, miniprogram exam page, answer save API and memory/Supabase adapters exist; M3 screenshot evidence exists. | Repo-proven local | Prove hosted Supabase persistence and weak-network/miniprogram resume on device. |
| P0-03 | Four-level AI tutoring with pre-AI answer snapshot and low-level no-answer leak. | `requestAiHelp` saves blank/current answer before AI; AI golden check covers 60 hints with zero leaks. | Repo-proven local | Persist prompt/model versions in hosted Supabase and add provider cost/latency records. |
| P0-04 | AI estimation: objective deterministic, fill-blank equivalence, free-response rubric evidence and review. | `packages/grader` supports deterministic scoring, math normalization, rubric scoring and review flags; grading golden check passes. | Repo-proven local | Replace MVP synchronous grading path with hosted queue/worker evidence and richer subjective calibration set. |
| P0-05 | Dual score report: independent score uses first pre-AI answer; collaborative score uses final submitted answer. | Memory and Supabase adapters now compute independent answers from first `preAiVersionId`; store-backend contract checks an AI-before/after score delta. | Repo-proven local | Hosted Supabase smoke must prove `independentScore < collaborativeScore` against dev data. |
| P0-06 | Wrong-question details and share flow with privacy boundary. | Report page links to a dedicated wrong-question view, Web and miniprogram both filter missed-score or review-required questions, share-card API/public share API expose public fields only, share visibility controls hide score, region and paper fields, edge-case poster checks generate 0-score, full-score, long-paper and hidden-field PNGs, memory mode generates a 1080x1440 PNG poster data URL, and Supabase adapter uploads the PNG to the `share-cards` Storage bucket before writing `share_cards.object_url`. | Repo-proven local | Prove hosted Supabase Storage upload and repeat edge cases with real browser/mobile screenshots on Vercel Preview. |
| P0-07 | Operations backend for paper import, rubric review, AI config and review queue. | Admin paper preview, paper import dry-run page and review queue screens exist; import API records validated/rejected/imported batches, checks 30-50 question payloads, score totals, answer keys and rubrics, uses explicit `replace_preview` conflict policy, commits accepted imports into paper/section/question/answer/rubric rows, and maps Supabase mode to `paper_import_batches` plus `audit_logs`; migration includes model configs, prompt versions, `review_tasks` and audit logs; review queue supports assigned/resolved/rejected workflow actions and manual score adjustment audit through service APIs. | Partial | Prove hosted Supabase import commit and manual score adjustment writes, then add rubric review state machine and richer score-calibration workflow. |

## Hard Invariant Traceability

| ID | Invariant | Evidence | Status |
| --- | --- | --- | --- |
| INV-01 | Mini program and browser never hold AI keys, Supabase service-role key or WeChat AppSecret. | Runtime and miniprogram contract checks scan env and source boundaries. | Repo-proven local |
| INV-02 | All core writes go through service APIs. | Miniprogram API client calls `/api/v1/*`; no Supabase direct client variables are exposed by default. | Repo-proven local |
| INV-03 | First AI tutoring call stores `pre_ai_answer_version`, including blank answer. | Memory and Supabase store adapters save/read `preAiVersionId`; store-backend contract asserts the pre-AI id. | Repo-proven local |
| INV-04 | Submit is idempotent and returns the same grading/report for repeated key. | Memory submit map and Supabase idempotency query exist; hosted smoke covers dev path when enabled. | Repo-proven local, hosted pending |
| INV-05 | Share page exposes only user-allowed public fields. | `share_cards.public_fields` and public share token route return share card fields only; score, paper title and region are nullable according to the user's share visibility settings. | Repo-proven local |
| INV-06 | AI estimation must not pretend to be official scoring. | Report and share-card disclaimer say AI estimation is not official Gaokao score. | Repo-proven local |
| INV-07 | Production deployment, hosted migrations, paid resources and real privacy data require human confirmation. | Deployment gates document the pause points; no external project was created in this worktree. | Policy-proven |

## Current Material Gaps

- Hosted evidence is still missing: GitHub repo URL, CI run URL, Vercel Preview URL, Supabase project ref, hosted migration history and hosted smoke output.
- Paper matching is locally represented by one MVP mapping rule; multi-candidate matching and hosted table evidence are still pending.
- Wrong-question review is local and per-report; durable hosted history still depends on Supabase smoke evidence.
- Share poster generation, visibility controls and edge-case PNG checks are local/code-proven; hosted Supabase Storage upload is still missing real project evidence.
- Operations backend now has import dry-run/accepted-commit evidence, review queue state transitions and manual score adjustment audit, but still lacks hosted import/review proof, rubric review and richer score-calibration workflows.
- WeChat real-device, legal request domain, privacy prompt and AI explanation screenshots remain manual gates.
- Performance, security and review rehearsal from PRD tables 68-69 are not yet proven.

## Next Slice Recommendation

The next slice should collect hosted Supabase smoke and Vercel Preview evidence after explicit external-account confirmation. It should prove migration history, Storage upload, public share token lookup, Vercel health with `storage: "supabase"` and a Web preview URL before moving to WeChat real-device gates.
