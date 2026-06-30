import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { mvpPaper, type PaperImportPayload } from "@gaokao-xinsheng/contracts";
import { createPaperImport, getImportedPaper } from "../apps/web/src/lib/exam-store-backend";

const repoRoot = process.cwd();

function read(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const previousBackend = process.env.EXAM_STORE_BACKEND;
const previousSupabaseUrl = process.env.SUPABASE_URL;
const previousServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const previousAdapterEnabled = process.env.SUPABASE_STORE_ADAPTER_ENABLED;

async function main() {
  const requiredFiles = [
    "apps/web/src/lib/paper-import.ts",
    "apps/web/src/app/api/v1/admin/paper-imports/route.ts",
    "apps/web/src/app/admin/papers/import/page.tsx",
    "apps/web/src/app/admin/papers/import/ImportPaperClient.tsx",
    "supabase/migrations/202606290006_paper_import_batches.sql"
  ];

  for (const file of requiredFiles) {
    assert(existsSync(path.join(repoRoot, file)), `Missing paper import file: ${file}`);
  }

  const contracts = read("packages/contracts/src/index.ts");
  const route = read("apps/web/src/app/api/v1/admin/paper-imports/route.ts");
  const client = read("apps/web/src/app/admin/papers/import/ImportPaperClient.tsx");
  const adminPage = read("apps/web/src/app/admin/page.tsx");
  const papersPage = read("apps/web/src/app/admin/papers/page.tsx");
  const memoryStore = read("apps/web/src/lib/exam-store.ts");
  const backendFacade = read("apps/web/src/lib/exam-store-backend.ts");
  const supabaseStore = read("apps/web/src/lib/supabase-exam-store.ts");
  const migration = read("supabase/migrations/202606290006_paper_import_batches.sql");
  const seed = read("supabase/seed/seed.sql");
  const packageJson = JSON.parse(read("package.json")) as {
    scripts?: Record<string, string>;
  };
  const normalizedMigration = migration.replace(/\s+/g, " ").toLowerCase();

  assert(contracts.includes("PaperImportRequestSchema"), "Shared contracts must define PaperImportRequestSchema.");
  assert(contracts.includes(".min(30).max(50)"), "Paper import schema must limit MVP question count to 30-50.");
  assert(contracts.includes("replace_preview"), "Paper import schema must expose an explicit conflict policy.");
  assert(route.includes("PaperImportRequestSchema.safeParse"), "Paper import route must validate with the shared schema.");
  assert(route.includes("createPaperImport"), "Paper import route must call the backend facade.");
  assert(client.includes("校验演练"), "Admin import UI must expose dry-run validation.");
  assert(client.includes("记录批次"), "Admin import UI must expose import batch recording.");
  assert(adminPage.includes("/admin/papers/import"), "Admin landing page must link to paper import.");
  assert(papersPage.includes("/admin/papers/import"), "Paper list page must link to paper import.");
  assert(memoryStore.includes("paperImportBatches"), "Memory store must keep paper import batches.");
  assert(memoryStore.includes("importedPapers"), "Memory store must commit accepted imports into a local registry.");
  assert(backendFacade.includes("createPaperImport"), "Backend facade must expose paper import.");
  assert(supabaseStore.includes("paper_import_batches"), "Supabase adapter must write paper_import_batches.");
  assert(supabaseStore.includes("action: batch.auditAction"), "Supabase adapter must write namespaced audit actions.");
  assert(supabaseStore.includes("commitImportedPaper"), "Supabase adapter must commit accepted paper imports.");
  assert(supabaseStore.includes("on_conflict: \"paper_id,order_no\""), "Supabase import commit must upsert sections by paper/order.");
  assert(supabaseStore.includes("on_conflict: \"question_id,version\""), "Supabase import commit must upsert answer keys and rubrics by version.");
  assert(
    normalizedMigration.includes("create table if not exists public.paper_import_batches"),
    "Migration must create paper_import_batches."
  );
  assert(
    normalizedMigration.includes("alter table public.paper_import_batches enable row level security"),
    "paper_import_batches must enable RLS."
  );
  assert(normalizedMigration.includes("idx_paper_import_batches_paper_created"), "Missing paper import paper index.");
  assert(normalizedMigration.includes("idx_paper_import_batches_status_created"), "Missing paper import status index.");
  assert(normalizedMigration.includes("conflict_policy text not null"), "Paper import batches must persist conflict policy.");
  assert(normalizedMigration.includes("commit_summary jsonb not null"), "Paper import batches must persist commit summary.");
  assert(
    !/\bgrant\b[^;]+\bto\s+anon\b/i.test(migration) && !/\bgrant\b[^;]+\bto\s+authenticated\b/i.test(migration),
    "Paper import migration must not grant direct client access."
  );
  assert(seed.includes("'选择题', 1, 70"), "Seed section score must match the 150-point fixture choice total.");
  assert(seed.includes("'填空题', 2, 40"), "Seed section score must match the 150-point fixture fill-blank total.");
  assert(seed.includes("'解答题', 3, 40"), "Seed section score must match the 150-point fixture free-response total.");
  assert(!seed.includes("free_response', '已知函数f(x)=x^2-4x+3，求其零点并说明步骤。', 'x=1,3', 10"), "Seed must not keep old 10-point free-response rows.");
  assert(
    packageJson.scripts?.["test:paper-import"] === "tsx scripts/paper-import-contract-check.ts",
    "Missing paper import contract script."
  );
  assert(packageJson.scripts?.verify?.includes("test:paper-import"), "Default verify must include paper import checks.");

  process.env.EXAM_STORE_BACKEND = "memory";
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_STORE_ADAPTER_ENABLED;

  const samplePaper: PaperImportPayload = mvpPaper;
  const dryRunBatch = await createPaperImport({
    paper: samplePaper,
    dryRun: true,
    actor: "contract-importer"
  });

  assert(dryRunBatch.status === "VALIDATED", "Valid MVP paper import should dry-run as VALIDATED.");
  assert(dryRunBatch.dryRun === true, "Dry-run import must keep dryRun=true.");
  assert(dryRunBatch.conflictPolicy === "replace_preview", "Import batch must record the explicit conflict policy.");
  assert(!dryRunBatch.commitSummary.committed, "Dry-run import must not commit rows.");
  assert(dryRunBatch.paperId === mvpPaper.id, "Import batch must record the paper id.");
  assert(dryRunBatch.summary.questionCount === 30, "Import summary must count 30 MVP questions.");
  assert(dryRunBatch.summary.totalScore === 150, "Import summary must record paper total score.");
  assert(dryRunBatch.summary.maxScoreSum === 150, "Import summary must match question max-score total.");
  assert(dryRunBatch.summary.answerKeyCount === 30, "Import summary must count answer keys.");
  assert(dryRunBatch.summary.rubricQuestionCount > 0, "Import summary must count rubric-backed questions.");
  assert(!dryRunBatch.issues.some((issue) => issue.severity === "error"), "Valid MVP paper must have no import errors.");
  assert(/^[a-f0-9]{64}$/.test(dryRunBatch.payloadHash), "Import batch must record a SHA-256 payload hash.");

  const importedBatch = await createPaperImport({
    paper: samplePaper,
    dryRun: false,
    conflictPolicy: "replace_preview",
    actor: "contract-importer"
  });
  const committedPaper = await getImportedPaper(samplePaper.id);

  assert(importedBatch.status === "IMPORTED", "Valid non-dry-run import should be marked as IMPORTED.");
  assert(importedBatch.commitSummary.committed, "Valid non-dry-run import must commit rows.");
  assert(importedBatch.commitSummary.paperRows === 1, "Import commit must include one paper row.");
  assert(importedBatch.commitSummary.questionRows === 30, "Import commit must include 30 question rows.");
  assert(importedBatch.commitSummary.answerKeyRows === 30, "Import commit must include 30 answer-key rows.");
  assert(importedBatch.commitSummary.rubricRows === 8, "Import commit must include 8 rubric rows.");
  assert(committedPaper?.id === samplePaper.id, "Memory import commit must make the paper retrievable.");

  const invalidPaper: PaperImportPayload = {
    ...samplePaper,
    totalScore: samplePaper.totalScore + 1,
    questions: samplePaper.questions.map((question, index) =>
      index === 1
        ? {
            ...question,
            orderNo: samplePaper.questions[0]?.orderNo ?? question.orderNo
          }
        : question
    )
  };
  const rejectedBatch = await createPaperImport({
    paper: invalidPaper,
    dryRun: false,
    actor: "contract-importer"
  });

  assert(rejectedBatch.status === "REJECTED", "Invalid paper import should be rejected.");
  assert(!rejectedBatch.commitSummary.committed, "Rejected import must not commit rows.");
  assert(
    rejectedBatch.issues.some((issue) => issue.code === "QUESTION_ORDER_DUPLICATE"),
    "Invalid paper import must report duplicate question order."
  );
  assert(
    rejectedBatch.issues.some((issue) => issue.code === "PAPER_TOTAL_SCORE_MISMATCH"),
    "Invalid paper import must report total score mismatch."
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        validStatus: dryRunBatch.status,
        rejectedStatus: rejectedBatch.status,
        importedStatus: importedBatch.status,
        questionCount: dryRunBatch.summary.questionCount,
        maxScoreSum: dryRunBatch.summary.maxScoreSum,
        committedQuestionRows: importedBatch.commitSummary.questionRows,
        directClientGrants: 0
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    if (previousBackend === undefined) {
      delete process.env.EXAM_STORE_BACKEND;
    } else {
      process.env.EXAM_STORE_BACKEND = previousBackend;
    }

    if (previousSupabaseUrl === undefined) {
      delete process.env.SUPABASE_URL;
    } else {
      process.env.SUPABASE_URL = previousSupabaseUrl;
    }

    if (previousServiceKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceKey;
    }

    if (previousAdapterEnabled === undefined) {
      delete process.env.SUPABASE_STORE_ADAPTER_ENABLED;
    } else {
      process.env.SUPABASE_STORE_ADAPTER_ENABLED = previousAdapterEnabled;
    }
  });
