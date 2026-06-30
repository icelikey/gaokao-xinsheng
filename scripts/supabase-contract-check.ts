import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const supabaseRoot = path.join(repoRoot, "supabase");
const migrationsRoot = path.join(supabaseRoot, "migrations");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function read(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

assert(existsSync(migrationsRoot), "Missing supabase/migrations directory.");

const migrations = readdirSync(migrationsRoot)
  .filter((file) => file.endsWith(".sql"))
  .sort();
const migrationText = migrations.map((file) => read(path.join("supabase", "migrations", file))).join("\n\n");
const normalized = migrationText.replace(/\s+/g, " ").toLowerCase();
const config = read("supabase/config.toml");
const supabaseServer = read("apps/web/src/lib/supabase-server.ts");
const supabaseStore = read("apps/web/src/lib/supabase-exam-store.ts");
const sharePoster = read("apps/web/src/lib/share-poster.ts");
const seed = read("supabase/seed/seed.sql");
const hostedSmoke = read("scripts/supabase-hosted-smoke.ts");
const packageJson = JSON.parse(read("package.json")) as {
  scripts?: Record<string, string>;
};

const requiredTables = [
  "users",
  "user_profiles",
  "papers",
  "paper_mapping_rules",
  "sections",
  "questions",
  "answer_keys",
  "grading_rubrics",
  "exam_sessions",
  "answer_versions",
  "ai_help_events",
  "grading_jobs",
  "grading_results",
  "exam_reports",
  "share_cards",
  "paper_import_batches",
  "review_tasks",
  "model_configs",
  "prompt_versions",
  "audit_logs"
];

for (const table of requiredTables) {
  assert(
    normalized.includes(`create table public.${table}`) ||
      normalized.includes(`create table if not exists public.${table}`),
    `Missing required Supabase table: public.${table}`
  );
}

const rlsTables = [
  "users",
  "user_profiles",
  "exam_sessions",
  "answer_versions",
  "ai_help_events",
  "grading_jobs",
  "grading_results",
  "exam_reports",
  "share_cards",
  "paper_import_batches",
  "review_tasks"
];

for (const table of rlsTables) {
  assert(
    normalized.includes(`alter table public.${table} enable row level security`),
    `Missing RLS enablement for private table: public.${table}`
  );
}

assert(normalized.includes('create extension if not exists "pgcrypto"'), "Missing pgcrypto extension.");
assert(normalized.includes("create extension if not exists pgmq"), "Missing pgmq extension.");
assert(normalized.includes("pgmq.create('grading_jobs')"), "Missing grading_jobs queue creation.");
assert(normalized.includes("create or replace function public.enqueue_grading_job"), "Missing grading enqueue RPC.");
assert(normalized.includes("grant execute on function public.enqueue_grading_job(uuid, uuid) to service_role"), "Enqueue RPC must be service-role-only.");
assert(!/\bgrant\b[^;]+\bto\s+anon\b/i.test(migrationText), "Migrations must not grant direct anon access.");
assert(!/\bgrant\b[^;]+\bto\s+authenticated\b/i.test(migrationText), "Migrations must not grant direct authenticated access yet.");
assert(normalized.includes("create or replace view public.review_queue"), "Missing reviewer queue view.");
assert(normalized.includes("coalesce(rt.status, 'open') as review_status"), "review_queue must expose review workflow status.");
assert(normalized.includes("audit_count"), "review_queue must expose review workflow audit counts.");
assert(normalized.includes("not in ('resolved', 'rejected')"), "review_queue must exclude terminal review items.");
assert(normalized.includes("object_url text"), "share_cards must retain rendered poster object_url.");
assert(normalized.includes("token text not null unique"), "share_cards must keep unique public token.");
assert(normalized.includes("add column if not exists idempotency_key text"), "share_cards must support idempotency keys.");
assert(normalized.includes("idx_share_cards_report_idempotency"), "share_cards must enforce report idempotency.");
assert(normalized.includes("create table public.paper_mapping_rules"), "Missing paper mapping rules table.");
assert(normalized.includes("idx_paper_mapping_rules_lookup"), "Missing paper mapping lookup index.");
assert(normalized.includes("create table if not exists public.paper_import_batches"), "Missing paper import batches table.");
assert(normalized.includes("idx_paper_import_batches_paper_created"), "Missing paper import paper lookup index.");
assert(normalized.includes("idx_paper_import_batches_status_created"), "Missing paper import status lookup index.");
assert(normalized.includes("conflict_policy text not null"), "Paper import batches must persist conflict policy.");
assert(normalized.includes("commit_summary jsonb not null"), "Paper import batches must persist commit summary.");
assert(seed.includes("pmr_2010_sd_math_sci_quick"), "Missing MVP paper mapping seed.");
assert(seed.includes("'选择题', 1, 70"), "Seed choice section score must match current fixture.");
assert(seed.includes("'填空题', 2, 40"), "Seed fill-blank section score must match current fixture.");
assert(seed.includes("'解答题', 3, 40"), "Seed free-response section score must match current fixture.");

assert(config.includes("[storage.buckets.share-cards]"), "Missing share-cards storage bucket config.");
assert(config.includes("public = true"), "share-cards bucket public setting is missing.");
assert(config.includes('allowed_mime_types = ["image/png", "image/jpeg", "image/webp"]'), "share-cards bucket MIME allow-list is missing.");
assert(supabaseServer.includes("/storage/v1/object/"), "Supabase server helper must target the Storage object API.");
assert(supabaseServer.includes("x-upsert"), "Supabase storage helper must support explicit upsert control.");
assert(supabaseStore.includes("supabaseStorageUpload"), "Supabase share-card flow must upload a rendered poster object.");
assert(supabaseStore.includes("object_url: objectUrl"), "Supabase share-card flow must persist the poster object URL.");
assert(supabaseStore.includes("commitImportedPaper"), "Supabase paper import flow must commit accepted paper rows.");
assert(supabaseStore.includes("on_conflict: \"paper_id,order_no\""), "Supabase paper import flow must upsert sections by paper/order.");
assert(sharePoster.includes("SHARE_POSTER_BUCKET = \"share-cards\""), "Share-poster renderer must target the share-cards bucket.");
assert(sharePoster.includes("SHARE_POSTER_MIME_TYPE = \"image/png\""), "Share-poster renderer must generate PNG objects.");
assert(
  packageJson.scripts?.["test:supabase-hosted-smoke"] === "tsx scripts/supabase-hosted-smoke.ts",
  "Missing optional hosted Supabase smoke-test script."
);
assert(hostedSmoke.includes("createPaperImport"), "Hosted Supabase smoke must prove paper import commit.");
assert(hostedSmoke.includes("paperImportQuestionRows"), "Hosted Supabase smoke output must report paper import rows.");
assert(hostedSmoke.includes("adjustReportQuestionScore"), "Hosted Supabase smoke must prove manual score adjustment audit.");
assert(
  !packageJson.scripts?.verify?.includes("test:supabase-hosted-smoke"),
  "Hosted Supabase smoke test must remain outside default verify because it writes dev cloud rows."
);

console.log(
  JSON.stringify(
    {
      ok: true,
      migrations: migrations.length,
      requiredTables: requiredTables.length,
      rlsTables: rlsTables.length,
      hasPaperMappingRules: true,
      hasQueue: true,
      hasShareBucket: true,
      hasShareIdempotency: true,
      hasPaperImportBatches: true,
      hasPaperImportCommit: true,
      hasSharePosterUpload: true,
      hasHostedSmokeScript: true,
      hostedSmokeInDefaultVerify: false,
      directClientGrants: 0
    },
    null,
    2
  )
);
