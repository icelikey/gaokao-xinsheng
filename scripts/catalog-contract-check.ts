import {
  getCatalogRegions,
  getCatalogYears,
  getDefaultPaperMatchInput,
  matchPapers,
  mvpPaper,
  type PaperMatchInput
} from "@gaokao-xinsheng/contracts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const years = getCatalogYears();
const regions = getCatalogRegions({ year: 2010 });
const defaultInput = getDefaultPaperMatchInput();
const match = matchPapers(defaultInput);
const noMatchInput = {
  ...defaultInput,
  region: "北京"
} satisfies PaperMatchInput;
const noMatch = matchPapers(noMatchInput);

assert(years.some((item) => item.year === 2010 && item.label === "2010届"), "Catalog years must expose 2010届.");
assert(years.every((item) => item.yearsAgo >= 0), "Catalog years must expose a non-negative yearsAgo value.");
assert(regions.some((item) => item.region === "山东" && item.regionCode === "SD"), "Catalog regions must expose 山东/SD.");
assert(regions.some((item) => item.tracks.includes("理科")), "Catalog regions must expose 理科 track.");
assert(defaultInput.year === 2010, "Default match input must use the MVP cohort year.");
assert(defaultInput.region === "山东", "Default match input must use the MVP region.");
assert(defaultInput.track === "理科", "Default match input must use the MVP track.");
assert(defaultInput.subject === "数学", "Default match input must use the MVP subject.");
assert(match.candidates.length === 1, "MVP match should return exactly one candidate.");
assert(match.autoSelectedPaperId === mvpPaper.id, "High-confidence MVP candidate should auto-select.");
assert(match.candidates[0].id === mvpPaper.id, "Matched candidate must point to the MVP paper.");
assert(match.candidates[0].questionCount === 30, "Matched candidate must expose the MVP question count.");
assert(match.candidates[0].confidence >= 0.9, "Matched candidate must have high confidence.");
assert(noMatch.candidates.length === 0, "Unknown region must not match a paper.");

const publicCandidateJson = JSON.stringify(match.candidates[0]);
assert(!publicCandidateJson.includes('"answer"'), "Catalog candidate must not expose answers.");
assert(!publicCandidateJson.includes('"rubric"'), "Catalog candidate must not expose rubrics.");

console.log(
  JSON.stringify(
    {
      ok: true,
      years: years.length,
      regions: regions.length,
      candidateCount: match.candidates.length,
      autoSelectedPaperId: match.autoSelectedPaperId,
      noAnswerLeak: true,
      unknownRegionMatches: noMatch.candidates.length
    },
    null,
    2
  )
);
