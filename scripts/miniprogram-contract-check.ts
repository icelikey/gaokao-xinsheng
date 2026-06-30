import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getMvpPaper, getPublicMvpPaper } from "@gaokao-xinsheng/contracts";

const repoRoot = process.cwd();
const appRoot = path.join(repoRoot, "apps", "miniprogram");

function readText(relativePath: string) {
  return readFileSync(path.join(appRoot, relativePath), "utf8");
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readText(relativePath)) as T;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const requiredFiles = [
  "project.config.json",
  "app.json",
  "app.js",
  "app.wxss",
  "env.js",
  "utils/api.js",
  "utils/answers.js",
  "pages/index/index.js",
  "pages/index/index.wxml",
  "pages/exam/index.js",
  "pages/exam/index.wxml",
  "pages/report/index.js",
  "pages/report/index.wxml",
  "pages/mistakes/index.js",
  "pages/mistakes/index.wxml",
  "pages/mistakes/index.wxss",
  "pages/share/index.js",
  "pages/share/index.wxml"
];

for (const file of requiredFiles) {
  assert(existsSync(path.join(appRoot, file)), `Missing miniprogram file: ${file}`);
}

const appJson = readJson<{ pages: string[] }>("app.json");
const expectedPages = [
  "pages/index/index",
  "pages/exam/index",
  "pages/report/index",
  "pages/mistakes/index",
  "pages/share/index"
];

for (const page of expectedPages) {
  assert(appJson.pages.includes(page), `Missing miniprogram page in app.json: ${page}`);
}

const apiClient = readText("utils/api.js");
const envFile = readText("env.js");
const appFile = readText("app.js");
const indexPage = readText("pages/index/index.js");
const indexMarkup = readText("pages/index/index.wxml");
const examPage = readText("pages/exam/index.js");
const reportPage = readText("pages/report/index.js");
const reportMarkup = readText("pages/report/index.wxml");
const mistakesPage = readText("pages/mistakes/index.js");
const mistakesMarkup = readText("pages/mistakes/index.wxml");
const sharePage = readText("pages/share/index.js");
const shareMarkup = readText("pages/share/index.wxml");
const sourceBundle = [
  apiClient,
  envFile,
  appFile,
  indexPage,
  examPage,
  reportPage,
  mistakesPage,
  sharePage
].join("\n");
const forbiddenPatterns = [
  /SUPABASE_SERVICE_ROLE_KEY/i,
  /OPENAI_API_KEY/i,
  /APP_SECRET/i,
  /AppSecret/i,
  /sk-[a-zA-Z0-9]/,
  /service_role/i
];

for (const pattern of forbiddenPatterns) {
  assert(!pattern.test(sourceBundle), `Forbidden secret-like pattern found: ${pattern}`);
}

assert(apiClient.includes("/api/v1/papers/"), "Miniprogram must use the public paper API.");
assert(!apiClient.includes("/api/catalog/"), "Miniprogram must not use admin catalog APIs.");
assert(apiClient.includes("/api/v1/catalog/years"), "Miniprogram must use v1 catalog years API.");
assert(apiClient.includes("/api/v1/catalog/regions"), "Miniprogram must use v1 catalog regions API.");
assert(apiClient.includes("/api/v1/catalog/match"), "Miniprogram must use v1 catalog match API.");
assert(apiClient.includes("/api/v1/exam-sessions"), "Miniprogram must use exam session APIs.");
assert(apiClient.includes("/api/v1/reports/"), "Miniprogram must use report APIs.");
assert(apiClient.includes("/api/v1/share/"), "Miniprogram must use public share APIs.");
assert(
  apiClient.includes("function createShareCard(reportId, idempotencyKey, visibility = {})"),
  "Miniprogram API client must accept share visibility settings."
);
assert(apiClient.includes("data: { visibility }"), "Miniprogram share-card request must send visibility settings.");
assert(indexPage.includes("api.matchPapers"), "Miniprogram index page must match papers before session creation.");
assert(indexPage.includes("selectedPaperId"), "Miniprogram index page must store the selected matched paper id.");
assert(indexMarkup.includes('bindtap="matchPaper"'), "Miniprogram index markup must expose a paper match action.");
assert(indexMarkup.includes('range-key="title"'), "Miniprogram index markup must expose matched candidate titles.");
assert(!appFile.includes("paperId:"), "Miniprogram global app state must not pin a fixed paper id.");
assert(!envFile.includes("paperId"), "Miniprogram env must not pin a fixed paper id.");
assert(examPage.includes("api.getPublicPaper(session.paperId)"), "Miniprogram exam page must load the paper from the session paperId.");
assert(reportPage.includes("openMistakes()"), "Miniprogram report page must expose the mistakes navigation handler.");
assert(reportPage.includes("shareVisibility"), "Miniprogram report page must store share visibility settings.");
assert(reportPage.includes("onShareVisibilityChange"), "Miniprogram report page must expose the visibility toggle handler.");
assert(
  reportPage.includes("api.createShareCard(reportId, idempotencyKey, this.data.shareVisibility)"),
  "Miniprogram report page must pass visibility settings to share-card creation."
);
assert(reportPage.includes("wx.navigateTo"), "Miniprogram report page must navigate to the mistakes page.");
assert(
  reportPage.includes("/pages/mistakes/index?reportId="),
  "Miniprogram report page must pass reportId into the mistakes page."
);
assert(
  reportMarkup.includes('bindtap="openMistakes"'),
  "Miniprogram report markup must expose a user-visible mistakes action."
);
assert(
  reportMarkup.includes('bindtap="onShareVisibilityChange"'),
  "Miniprogram report markup must expose share visibility controls."
);
assert(reportMarkup.includes("data-field=\"showRegion\""), "Miniprogram report markup must expose the region visibility toggle.");
assert(
  mistakesPage.includes("api.getReport(this.data.reportId)"),
  "Miniprogram mistakes page must read the existing report API."
);
assert(mistakesPage.includes(".filter(isMistake)"), "Miniprogram mistakes page must filter report questions.");
assert(
  mistakesPage.includes("question.score < question.maxScore || question.requiresReview"),
  "Miniprogram mistakes page must include missed-score and manual-review questions."
);
assert(mistakesMarkup.includes('wx:for="{{mistakes}}"'), "Miniprogram mistakes page must render filtered questions.");
assert(mistakesMarkup.includes("{{item.correctAnswer}}"), "Miniprogram mistakes page must show reference answers in report context.");
assert(shareMarkup.includes("shareCard.objectUrl"), "Miniprogram public share page must render the generated poster URL.");
assert(shareMarkup.includes('class="posterImage"'), "Miniprogram public share page must style the poster image.");
assert(
  shareMarkup.includes("independentScore !== null") && shareMarkup.includes("collaborativeScore !== null"),
  "Miniprogram public share page must conditionally render hidden score fields."
);
assert(shareMarkup.includes("paperTitle"), "Miniprogram public share page must support optional paper title.");
assert(shareMarkup.includes("region"), "Miniprogram public share page must support optional region.");

const privatePaper = getMvpPaper();
const publicPaper = getPublicMvpPaper();

assert(privatePaper, "Private MVP paper fixture is missing.");
assert(publicPaper, "Public MVP paper fixture is missing.");
assert(privatePaper.questions.some((question) => Boolean(question.answer)), "Private fixture should contain answers.");
assert(publicPaper.questions.length === 30, "Public MVP paper should expose 30 questions.");

const publicPaperJson = JSON.stringify(publicPaper);
assert(!publicPaperJson.includes('"answer"'), "Public paper payload must not expose answers.");
assert(!publicPaperJson.includes('"rubric"'), "Public paper payload must not expose rubrics.");

console.log(
  JSON.stringify(
    {
      ok: true,
      appRoot: "apps/miniprogram",
      pages: appJson.pages.length,
      publicQuestions: publicPaper.questions.length,
      hasMistakesPage: true,
      rendersSharePoster: true,
      hasShareVisibilityControls: true,
      usesCatalogMatchApi: true,
      usesPublicPaperApi: true,
      secretLeakPatterns: 0
    },
    null,
    2
  )
);
