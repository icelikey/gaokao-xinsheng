import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function read(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const requiredFiles = [
  "apps/web/src/app/api/v1/admin/review-queue/route.ts",
  "apps/web/src/app/api/v1/admin/review-queue/[reportId]/route.ts",
  "apps/web/src/app/api/v1/admin/review-queue/[reportId]/score-adjustments/route.ts",
  "apps/web/src/app/admin/review-queue/ReviewQueueClient.tsx",
  "supabase/migrations/202606290005_review_workflow.sql"
];

for (const file of requiredFiles) {
  assert(existsSync(path.join(repoRoot, file)), `Missing review workflow file: ${file}`);
}

const packageJson = JSON.parse(read("package.json")) as {
  scripts?: Record<string, string>;
};
const contracts = read("packages/contracts/src/index.ts");
const route = read("apps/web/src/app/api/v1/admin/review-queue/[reportId]/route.ts");
const scoreRoute = read("apps/web/src/app/api/v1/admin/review-queue/[reportId]/score-adjustments/route.ts");
const queueRoute = read("apps/web/src/app/api/v1/admin/review-queue/route.ts");
const client = read("apps/web/src/app/admin/review-queue/ReviewQueueClient.tsx");
const memoryStore = read("apps/web/src/lib/exam-store.ts");
const facade = read("apps/web/src/lib/exam-store-backend.ts");
const supabaseStore = read("apps/web/src/lib/supabase-exam-store.ts");
const migration = read("supabase/migrations/202606290005_review_workflow.sql");
const globals = read("apps/web/src/app/globals.css");
const storeContract = read("scripts/store-backend-contract-check.ts");
const normalizedMigration = migration.replace(/\s+/g, " ").toLowerCase();

assert(contracts.includes("ReviewActionSchema"), "Shared contracts must define ReviewActionSchema.");
assert(contracts.includes('z.enum(["ASSIGN", "RESOLVE", "REJECT"])'), "Review action schema must limit workflow actions.");
assert(contracts.includes("ReviewScoreAdjustmentSchema"), "Shared contracts must define ReviewScoreAdjustmentSchema.");
assert(route.includes("ReviewActionSchema.safeParse"), "Review action route must validate payloads with the shared schema.");
assert(route.includes("updateReviewQueueItem"), "Review action route must call the backend facade.");
assert(scoreRoute.includes("ReviewScoreAdjustmentSchema.safeParse"), "Score adjustment route must validate payloads with the shared schema.");
assert(scoreRoute.includes("adjustReportQuestionScore"), "Score adjustment route must call the backend facade.");
assert(queueRoute.includes("listReviewQueue"), "Review queue route must keep the list endpoint.");
assert(client.includes("runReviewAction"), "Admin review queue UI must expose workflow actions.");
assert(client.includes("runScoreAdjustment"), "Admin review queue UI must expose score adjustment action.");
assert(client.includes('action: "ASSIGN"') || client.includes('"ASSIGN"'), "Admin UI must expose assign action.");
assert(client.includes('"RESOLVE"'), "Admin UI must expose resolve action.");
assert(client.includes('"REJECT"'), "Admin UI must expose reject action.");
assert(globals.includes(".reviewActions"), "Global styles must include review action controls.");
assert(facade.includes("updateReviewQueueItem"), "Backend facade must expose review workflow actions.");
assert(facade.includes("adjustReportQuestionScore"), "Backend facade must expose score adjustment actions.");
assert(memoryStore.includes("reviewAuditLogs"), "Memory store must keep review audit logs.");
assert(memoryStore.includes("beforeStatus"), "Memory audit log must record the previous status.");
assert(memoryStore.includes("afterStatus"), "Memory audit log must record the next status.");
assert(memoryStore.includes("beforeScore"), "Memory score adjustment audit must record previous score.");
assert(memoryStore.includes("afterScore"), "Memory score adjustment audit must record adjusted score.");
assert(supabaseStore.includes("review_tasks"), "Supabase adapter must write review_tasks.");
assert(supabaseStore.includes("audit_logs"), "Supabase adapter must write audit_logs.");
assert(supabaseStore.includes("review.${input.action.toLowerCase()}"), "Supabase audit action must be namespaced.");
assert(supabaseStore.includes("review.adjust_score"), "Supabase score adjustment audit action must be namespaced.");
assert(supabaseStore.includes("manualAdjustment"), "Supabase score adjustment must persist manual evidence.");
assert(normalizedMigration.includes("create table if not exists public.review_tasks"), "Migration must create review_tasks.");
assert(normalizedMigration.includes("alter table public.review_tasks enable row level security"), "review_tasks must enable RLS.");
assert(normalizedMigration.includes("coalesce(rt.status, 'open') as review_status"), "review_queue must expose workflow status.");
assert(normalizedMigration.includes("audit_count"), "review_queue must expose audit counts.");
assert(normalizedMigration.includes("not in ('resolved', 'rejected')"), "review_queue must exclude terminal reviews.");
assert(
  !/\bgrant\b[^;]+\bto\s+anon\b/i.test(migration) && !/\bgrant\b[^;]+\bto\s+authenticated\b/i.test(migration),
  "Review workflow migration must not grant direct client access."
);
assert(storeContract.includes("memoryReviewWorkflowAudited"), "Store contract must prove audited memory review workflow.");
assert(storeContract.includes("memoryScoreAdjustmentAudited"), "Store contract must prove audited score adjustment workflow.");
assert(
  packageJson.scripts?.["test:review-workflow"] === "tsx scripts/review-workflow-contract-check.ts",
  "Missing review workflow contract script."
);
assert(packageJson.scripts?.verify?.includes("test:review-workflow"), "Default verify must include review workflow checks.");

console.log(
  JSON.stringify(
    {
      ok: true,
      hasReviewActionRoute: true,
      hasReviewTasksMigration: true,
      hasReviewAuditLogs: true,
      hasScoreAdjustmentAudit: true,
      terminalReviewsLeaveQueue: true,
      directClientGrants: 0
    },
    null,
    2
  )
);
