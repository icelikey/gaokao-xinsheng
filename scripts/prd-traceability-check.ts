import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const traceabilityPath = "docs/product/prd-traceability.md";
const packagePath = "package.json";

function read(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const traceability = read(traceabilityPath);
const packageJson = JSON.parse(read(packagePath)) as {
  scripts?: Record<string, string>;
};

const requiredP0Ids = ["P0-01", "P0-02", "P0-03", "P0-04", "P0-05", "P0-06", "P0-07"];
const requiredInvariantIds = ["INV-01", "INV-02", "INV-03", "INV-04", "INV-05", "INV-06", "INV-07"];

assert(traceability.includes("239 paragraphs, 78 tables"), "Traceability document must record the extracted PRD shape.");
assert(traceability.includes("2026-06-26 20:40:29"), "Traceability document must record the PRD source timestamp.");
assert(traceability.includes("高考新生小程序_产品与技术开发文档_v1.0.docx"), "Traceability document must cite the source DOCX.");

for (const id of requiredP0Ids) {
  assert(traceability.includes(`| ${id} |`), `Missing P0 traceability row: ${id}`);
}

for (const id of requiredInvariantIds) {
  assert(traceability.includes(`| ${id} |`), `Missing invariant traceability row: ${id}`);
}

assert(traceability.includes("Repo-proven local"), "Traceability document must distinguish local repository proof.");
assert(traceability.includes("Partial"), "Traceability document must keep incomplete requirements visible.");
assert(traceability.includes("Hosted evidence is still missing"), "Traceability document must list hosted evidence gaps.");
assert(traceability.includes("Next Slice Recommendation"), "Traceability document must name the next slice.");
assert(traceability.includes("share visibility controls hide score"), "Traceability document must record share visibility coverage.");
assert(traceability.includes("edge-case poster checks generate"), "Traceability document must record share edge-case coverage.");
assert(traceability.includes("review queue supports assigned/resolved/rejected"), "Traceability document must record review workflow coverage.");
assert(traceability.includes("paper import dry-run page"), "Traceability document must record paper import dry-run coverage.");
assert(traceability.includes("paper_import_batches"), "Traceability document must record paper import batch storage coverage.");
assert(traceability.includes("commits accepted imports"), "Traceability document must record accepted paper import commit coverage.");
assert(traceability.includes("replace_preview"), "Traceability document must record the explicit paper import conflict policy.");
assert(traceability.includes("manual score adjustment audit"), "Traceability document must record manual score adjustment audit coverage.");
assert(traceability.includes("hosted Supabase smoke and Vercel Preview evidence"), "Traceability document must name the hosted-evidence next slice.");
assert(!traceability.includes("TBD"), "Traceability document must not leave TBD placeholders.");

assert(
  packageJson.scripts?.["test:prd-traceability"] === "tsx scripts/prd-traceability-check.ts",
  "Missing PRD traceability check script."
);
assert(
  packageJson.scripts?.verify?.includes("test:prd-traceability"),
  "Default verify must include PRD traceability checks."
);

console.log(
  JSON.stringify(
    {
      ok: true,
      sourceShape: "239 paragraphs, 78 tables",
      p0Rows: requiredP0Ids.length,
      invariantRows: requiredInvariantIds.length,
      hasHostedGapList: true,
      nextSlice: "hosted Supabase smoke and Vercel Preview evidence"
    },
    null,
    2
  )
);
