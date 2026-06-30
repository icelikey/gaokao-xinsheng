import { getMvpQuestionStats, mvpPaper, type MvpPaper } from "./mvp-paper";

type CatalogExamMode = "QUICK_15" | "FULL_PAPER";

export type PaperMatchInput = {
  year: number;
  region: string;
  track: string;
  subject: string;
  mode: CatalogExamMode;
};

export type PaperMappingRule = {
  id: string;
  year: number;
  region: string;
  regionCode: string;
  track: string;
  subject: string;
  mode: CatalogExamMode;
  paperId: string;
  confidence: number;
  explanation: string;
  status: "ACTIVE" | "INACTIVE";
};

export type CatalogYear = {
  year: number;
  label: string;
  yearsAgo: number;
};

export type CatalogRegion = {
  year: number;
  region: string;
  regionCode: string;
  tracks: string[];
};

export type PaperCandidate = {
  id: string;
  title: string;
  year: number;
  region: string;
  track: string;
  subject: string;
  paperType: MvpPaper["paperType"];
  totalScore: number;
  durationMinutes: number;
  questionCount: number;
  confidence: number;
  explanation: string;
};

export type PaperMatchResult = {
  input: PaperMatchInput;
  candidates: PaperCandidate[];
  autoSelectedPaperId: string | null;
};

export const paperMappingRules: PaperMappingRule[] = [
  {
    id: "pmr_2010_sd_math_sci_quick",
    year: 2010,
    region: "山东",
    regionCode: "SD",
    track: "理科",
    subject: "数学",
    mode: "QUICK_15",
    paperId: mvpPaper.id,
    confidence: 0.96,
    explanation: "MVP首发精选卷：2010届山东理科数学，15分钟快考版本。",
    status: "ACTIVE"
  }
];

function yearsAgo(year: number) {
  return new Date().getFullYear() - year;
}

function candidateFromRule(rule: PaperMappingRule): PaperCandidate | null {
  const paper = rule.paperId === mvpPaper.id ? mvpPaper : null;

  if (!paper) {
    return null;
  }

  const stats = getMvpQuestionStats(paper);

  return {
    id: paper.id,
    title: paper.title,
    year: paper.year,
    region: paper.region,
    track: paper.track,
    subject: paper.subject,
    paperType: paper.paperType,
    totalScore: paper.totalScore,
    durationMinutes: paper.durationMinutes,
    questionCount: stats.total,
    confidence: rule.confidence,
    explanation: rule.explanation
  };
}

export function getCatalogYears(rules: PaperMappingRule[] = paperMappingRules): CatalogYear[] {
  const years = Array.from(new Set(rules.filter((rule) => rule.status === "ACTIVE").map((rule) => rule.year))).sort(
    (a, b) => b - a
  );

  return years.map((year) => ({
    year,
    label: `${year}届`,
    yearsAgo: yearsAgo(year)
  }));
}

export function getCatalogRegions(input: {
  year?: number;
  rules?: PaperMappingRule[];
} = {}): CatalogRegion[] {
  const rules = (input.rules ?? paperMappingRules).filter(
    (rule) => rule.status === "ACTIVE" && (input.year ? rule.year === input.year : true)
  );
  const grouped = new Map<string, CatalogRegion>();

  for (const rule of rules) {
    const key = `${rule.year}:${rule.regionCode}`;
    const current =
      grouped.get(key) ??
      ({
        year: rule.year,
        region: rule.region,
        regionCode: rule.regionCode,
        tracks: []
      } satisfies CatalogRegion);

    if (!current.tracks.includes(rule.track)) {
      current.tracks.push(rule.track);
      current.tracks.sort();
    }

    grouped.set(key, current);
  }

  return Array.from(grouped.values()).sort((a, b) => b.year - a.year || a.region.localeCompare(b.region));
}

export function matchPapers(input: PaperMatchInput, rules: PaperMappingRule[] = paperMappingRules): PaperMatchResult {
  const candidates = rules
    .filter(
      (rule) =>
        rule.status === "ACTIVE" &&
        rule.year === input.year &&
        rule.region === input.region &&
        rule.track === input.track &&
        rule.subject === input.subject &&
        rule.mode === input.mode
    )
    .map(candidateFromRule)
    .filter((candidate): candidate is PaperCandidate => Boolean(candidate))
    .sort((a, b) => b.confidence - a.confidence);

  return {
    input,
    candidates,
    autoSelectedPaperId: candidates.length === 1 && candidates[0].confidence >= 0.9 ? candidates[0].id : null
  };
}

export function getDefaultPaperMatchInput(): PaperMatchInput {
  const rule = paperMappingRules[0];

  return {
    year: rule.year,
    region: rule.region,
    track: rule.track,
    subject: rule.subject,
    mode: rule.mode
  };
}
