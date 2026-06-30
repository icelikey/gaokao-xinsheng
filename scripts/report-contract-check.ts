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

function extractBlock(source: string, marker: string) {
  const markerIndex = source.indexOf(marker);
  assert(markerIndex >= 0, `Missing block marker: ${marker}`);

  const firstBrace = source.indexOf("{", markerIndex);
  assert(firstBrace >= 0, `Missing block opening brace after marker: ${marker}`);

  let depth = 0;
  for (let index = firstBrace; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") {
      depth += 1;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(firstBrace, index + 1);
      }
    }
  }

  throw new Error(`Unclosed block after marker: ${marker}`);
}

const requiredFiles = [
  "apps/web/src/app/reports/[reportId]/page.tsx",
  "apps/web/src/app/reports/[reportId]/ReportClient.tsx",
  "apps/web/src/app/reports/[reportId]/mistakes/page.tsx",
  "apps/web/src/app/reports/[reportId]/mistakes/MistakesClient.tsx",
  "apps/web/src/app/share/[token]/ShareClient.tsx",
  "apps/web/src/app/api/v1/share/[token]/route.ts"
];

for (const file of requiredFiles) {
  assert(existsSync(path.join(repoRoot, file)), `Missing report/share file: ${file}`);
}

const packageJson = JSON.parse(read("package.json")) as {
  scripts?: Record<string, string>;
};
const reportPage = read("apps/web/src/app/reports/[reportId]/page.tsx");
const reportClient = read("apps/web/src/app/reports/[reportId]/ReportClient.tsx");
const mistakesPage = read("apps/web/src/app/reports/[reportId]/mistakes/page.tsx");
const mistakesClient = read("apps/web/src/app/reports/[reportId]/mistakes/MistakesClient.tsx");
const shareClient = read("apps/web/src/app/share/[token]/ShareClient.tsx");
const shareRoute = read("apps/web/src/app/api/v1/share/[token]/route.ts");
const shareCardsRoute = read("apps/web/src/app/api/v1/reports/[reportId]/share-cards/route.ts");
const memoryStore = read("apps/web/src/lib/exam-store.ts");
const supabaseStore = read("apps/web/src/lib/supabase-exam-store.ts");
const sharePoster = read("apps/web/src/lib/share-poster.ts");
const supabaseServer = read("apps/web/src/lib/supabase-server.ts");
const globals = read("apps/web/src/app/globals.css");

assert(reportPage.includes("<ReportClient reportId={reportId} />"), "Report route must render ReportClient.");
assert(
  reportClient.includes("href={`/reports/${report.id}/mistakes`}"),
  "Report page must link to the dedicated mistakes page."
);
assert(reportClient.includes("generateShareCard"), "Report page must keep the share-card action.");
assert(reportClient.includes("shareVisibility"), "Report page must expose share visibility settings.");
assert(reportClient.includes("visibilityControls"), "Report page must render share visibility controls.");
assert(reportClient.includes("JSON.stringify({"), "Report page must send a share-card request body.");
assert(
  shareCardsRoute.includes("CreateShareCardSchema.safeParse"),
  "Share-card route must validate visibility settings with the shared contract."
);
assert(
  mistakesPage.includes("<MistakesClient reportId={reportId} />"),
  "Mistakes route must render MistakesClient."
);
assert(mistakesClient.includes("fetch(`/api/v1/reports/${reportId}`)"), "Mistakes page must read report data through the API.");
assert(mistakesClient.includes(".filter(isMistake)"), "Mistakes page must filter report questions.");
assert(
  mistakesClient.includes("question.score < question.maxScore || question.requiresReview"),
  "Mistakes page must include missed-score and manual-review questions."
);
assert(mistakesClient.includes("correctAnswer"), "Mistakes page must show reference answers in report context.");
assert(mistakesClient.includes("evidence"), "Mistakes page must show scoring evidence.");
assert(globals.includes(".mistakeCard"), "Global styles must include mistakes cards.");
assert(globals.includes(".mistakeDetailGrid"), "Global styles must include mistakes detail layout.");
assert(shareClient.includes("shareCard.objectUrl"), "Public share UI must render the generated poster object URL.");
assert(shareClient.includes("className=\"posterImage\""), "Public share UI must style the generated poster image.");
assert(shareClient.includes("!== null"), "Public share UI must conditionally render hidden score fields.");
assert(shareClient.includes("paperTitle"), "Public share UI must support the optional paper title field.");
assert(shareClient.includes("region"), "Public share UI must support the optional region field.");
assert(globals.includes(".posterImage"), "Global styles must include the poster image layout.");
assert(globals.includes(".visibilityControls"), "Global styles must include share visibility controls.");
assert(sharePoster.includes("SHARE_POSTER_WIDTH = 1080"), "Share poster must use the 1080px poster width.");
assert(sharePoster.includes("SHARE_POSTER_HEIGHT = 1440"), "Share poster must use the 1440px poster height.");
assert(sharePoster.includes("deflateSync"), "Share poster generation must create a compressed bitmap PNG.");
assert(supabaseServer.includes("/storage/v1/object/"), "Supabase server helper must upload poster objects through Storage.");
assert(supabaseStore.includes("supabaseStorageUpload"), "Supabase store must upload poster images to Storage.");
assert(supabaseStore.includes("object_url: objectUrl"), "Supabase store must persist the poster object URL.");

const forbiddenPublicShareTerms = ["userAnswer", "correctAnswer", "questions", "rubric", "answerVersions"];
for (const term of forbiddenPublicShareTerms) {
  assert(!shareClient.includes(term), `Public share UI must not expose private report term: ${term}`);
  assert(!shareRoute.includes(term), `Public share API route must not expose private report term: ${term}`);
}

const memoryPublicFields = extractBlock(memoryStore, "  return {\n    title: \"我重新完成了一场高考数学\"");
const allowedPublicFields = [
  "title",
  "paperTitle",
  "region",
  "independentScore",
  "collaborativeScore",
  "totalScore",
  "aiHelpCount",
  "reviewCount",
  "disclaimer",
  "visibility"
];

for (const field of allowedPublicFields) {
  assert(memoryPublicFields.includes(field), `Memory share-card public fields must include ${field}.`);
}

assert(
  supabaseStore.includes("buildSharePublicFields({"),
  "Supabase share-card public fields must use the shared public-field builder."
);
assert(
  supabaseStore.includes("visibility: input.visibility"),
  "Supabase share-card creation must pass visibility settings into the shared builder."
);

for (const term of forbiddenPublicShareTerms) {
  assert(!memoryPublicFields.includes(term), `Memory share-card public fields must not include ${term}.`);
}

assert(
  packageJson.scripts?.["test:report-contract"] === "tsx scripts/report-contract-check.ts",
  "Missing report contract check script."
);
assert(packageJson.scripts?.verify?.includes("test:report-contract"), "Default verify must include report contract checks.");

console.log(
  JSON.stringify(
    {
      ok: true,
      hasReportMistakesRoute: true,
      mistakeFilter: "score-or-review",
      posterBitmapContract: "1080x1440-png",
      publicSharePrivateFields: false,
      hasShareVisibilityControls: true,
      allowedPublicShareFields: allowedPublicFields.length
    },
    null,
    2
  )
);
