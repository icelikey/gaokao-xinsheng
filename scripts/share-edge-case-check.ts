import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";
import { mvpPaper, type MvpPaper } from "@gaokao-xinsheng/contracts";
import { buildSharePublicFields, type ExamReportRecord } from "../apps/web/src/lib/exam-store";
import {
  buildSharePosterBytes,
  SHARE_POSTER_HEIGHT,
  SHARE_POSTER_MIME_TYPE,
  SHARE_POSTER_WIDTH,
  type SharePosterPublicFields
} from "../apps/web/src/lib/share-poster";

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, "output");

type EdgeCase = {
  id: string;
  description: string;
  report: ExamReportRecord;
  paper: MvpPaper;
  visibility: SharePosterPublicFields["visibility"];
  expected: {
    independentScore: number | null;
    collaborativeScore: number | null;
    totalScore: number | null;
    paperTitleVisible: boolean;
    regionVisible: boolean;
  };
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function makeReport(input: {
  id: string;
  independentScore: number;
  collaborativeScore: number;
  totalScore: number;
  aiHelpCount: number;
  reviewCount: number;
}): ExamReportRecord {
  return {
    id: `report_edge_${input.id}`,
    sessionId: `session_edge_${input.id}`,
    gradingJobId: `gradejob_edge_${input.id}`,
    independentScore: input.independentScore,
    collaborativeScore: input.collaborativeScore,
    totalScore: input.totalScore,
    aiHelpCount: input.aiHelpCount,
    lowConfidenceCount: 0,
    reviewCount: input.reviewCount,
    questions: [],
    createdAt: "2026-06-29T00:00:00.000Z"
  };
}

function makePaper(input: { title?: string; region?: string } = {}): MvpPaper {
  return {
    ...mvpPaper,
    title: input.title ?? mvpPaper.title,
    region: input.region ?? mvpPaper.region
  };
}

function readPngInfo(bytes: Buffer) {
  const signature = bytes.subarray(0, 8).toString("hex");
  assert(signature === "89504e470d0a1a0a", "Generated edge poster must have a PNG signature.");
  assert(bytes.subarray(12, 16).toString("ascii") === "IHDR", "Generated edge poster must start with IHDR.");

  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const idatChunks: Buffer[] = [];
  let offset = 8;

  while (offset < bytes.length) {
    const chunkLength = bytes.readUInt32BE(offset);
    const chunkType = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    const chunkData = bytes.subarray(offset + 8, offset + 8 + chunkLength);

    if (chunkType === "IDAT") {
      idatChunks.push(chunkData);
    }

    offset += 12 + chunkLength;
  }

  const raw = inflateSync(Buffer.concat(idatChunks));
  const rowLength = width * 4 + 1;
  const colors = new Set<string>();

  for (let y = 0; y < height; y += 48) {
    const rowOffset = y * rowLength;
    assert(raw[rowOffset] === 0, "Generated edge poster must use filter type 0 rows.");

    for (let x = 0; x < width; x += 48) {
      const pixelOffset = rowOffset + 1 + x * 4;
      colors.add(raw.subarray(pixelOffset, pixelOffset + 4).toString("hex"));
    }
  }

  return {
    width,
    height,
    sampledColors: colors.size
  };
}

function validatePublicFields(edgeCase: EdgeCase, publicFields: SharePosterPublicFields) {
  assert(
    publicFields.independentScore === edgeCase.expected.independentScore,
    `${edgeCase.id} independent score visibility mismatch.`
  );
  assert(
    publicFields.collaborativeScore === edgeCase.expected.collaborativeScore,
    `${edgeCase.id} collaborative score visibility mismatch.`
  );
  assert(publicFields.totalScore === edgeCase.expected.totalScore, `${edgeCase.id} total score visibility mismatch.`);
  assert(
    Boolean(publicFields.paperTitle) === edgeCase.expected.paperTitleVisible,
    `${edgeCase.id} paper title visibility mismatch.`
  );
  assert(Boolean(publicFields.region) === edgeCase.expected.regionVisible, `${edgeCase.id} region visibility mismatch.`);
}

function validateShareViewportContract() {
  const globalsCss = readFileSync(path.join(repoRoot, "apps/web/src/app/globals.css"), "utf8");
  const shareClient = readFileSync(path.join(repoRoot, "apps/web/src/app/share/[token]/ShareClient.tsx"), "utf8");

  assert(globalsCss.includes(".shareCard"), "Share page must keep a bounded card container.");
  assert(globalsCss.includes("width: min(720px, 100%)"), "Share card must fit mobile viewport width.");
  assert(globalsCss.includes("max-height: min(68vh, 700px)"), "Poster image must have a viewport-relative max height.");
  assert(globalsCss.includes("@media (max-width: 640px)"), "Share page must keep the mobile breakpoint.");
  assert(globalsCss.includes(".scorePair {\n    grid-template-columns: 1fr;"), "Score pair must collapse to one column on mobile.");
  assert(shareClient.includes("hasVisibleScore"), "Share page must omit the score grid when both scores are hidden.");
  assert(shareClient.includes("paperTitle ? <span>"), "Share page must render paper title only when public.");
  assert(shareClient.includes("region ? <span>"), "Share page must render region only when public.");

  return true;
}

const longPaperTitle =
  "2010届山东理科数学MVP精选卷-超长卷名边界验证-函数导数数列立体几何概率统计综合训练版";
const longRegion = "山东-济南-移动端分享公开地区长标签";
const allVisible = {
  showIndependentScore: true,
  showCollaborativeScore: true,
  showPaperTitle: true,
  showRegion: true
};
const scoreOnly = {
  showIndependentScore: true,
  showCollaborativeScore: true,
  showPaperTitle: false,
  showRegion: false
};
const hiddenAll = {
  showIndependentScore: false,
  showCollaborativeScore: false,
  showPaperTitle: false,
  showRegion: false
};

const edgeCases: EdgeCase[] = [
  {
    id: "zero-score",
    description: "0 score visible share card.",
    report: makeReport({
      id: "zero",
      independentScore: 0,
      collaborativeScore: 0,
      totalScore: 150,
      aiHelpCount: 0,
      reviewCount: 30
    }),
    paper: makePaper(),
    visibility: scoreOnly,
    expected: {
      independentScore: 0,
      collaborativeScore: 0,
      totalScore: 150,
      paperTitleVisible: false,
      regionVisible: false
    }
  },
  {
    id: "full-score",
    description: "Full score visible share card.",
    report: makeReport({
      id: "full",
      independentScore: 150,
      collaborativeScore: 150,
      totalScore: 150,
      aiHelpCount: 2,
      reviewCount: 0
    }),
    paper: makePaper(),
    visibility: scoreOnly,
    expected: {
      independentScore: 150,
      collaborativeScore: 150,
      totalScore: 150,
      paperTitleVisible: false,
      regionVisible: false
    }
  },
  {
    id: "long-paper-visible",
    description: "Long paper title and region are public fields.",
    report: makeReport({
      id: "long",
      independentScore: 96,
      collaborativeScore: 121,
      totalScore: 150,
      aiHelpCount: 9,
      reviewCount: 3
    }),
    paper: makePaper({
      title: longPaperTitle,
      region: longRegion
    }),
    visibility: allVisible,
    expected: {
      independentScore: 96,
      collaborativeScore: 121,
      totalScore: 150,
      paperTitleVisible: true,
      regionVisible: true
    }
  },
  {
    id: "hidden-all",
    description: "Scores, paper title and region are all hidden.",
    report: makeReport({
      id: "hidden",
      independentScore: 88,
      collaborativeScore: 108,
      totalScore: 150,
      aiHelpCount: 4,
      reviewCount: 1
    }),
    paper: makePaper({
      title: longPaperTitle,
      region: longRegion
    }),
    visibility: hiddenAll,
    expected: {
      independentScore: null,
      collaborativeScore: null,
      totalScore: null,
      paperTitleVisible: false,
      regionVisible: false
    }
  }
];

function main() {
  mkdirSync(outputDir, { recursive: true });
  const samplePublicFields = buildSharePublicFields({
    report: makeReport({
      id: "sample",
      independentScore: 86,
      collaborativeScore: 108,
      totalScore: 150,
      aiHelpCount: 3,
      reviewCount: 1
    }),
    paper: makePaper(),
    visibility: scoreOnly
  });
  const samplePoster = buildSharePosterBytes({
    publicFields: samplePublicFields,
    token: "sample_sharetoken",
    objectPath: "samples/share-poster-sample.png"
  });
  const samplePngInfo = readPngInfo(samplePoster.bytes);
  const sampleOutputPath = path.join(outputDir, "share-poster-sample.png");
  writeFileSync(sampleOutputPath, samplePoster.bytes);
  assert(samplePngInfo.width === SHARE_POSTER_WIDTH, "Sample poster width mismatch.");
  assert(samplePngInfo.height === SHARE_POSTER_HEIGHT, "Sample poster height mismatch.");

  const manifest = edgeCases.map((edgeCase) => {
    const publicFields = buildSharePublicFields({
      report: edgeCase.report,
      paper: edgeCase.paper,
      visibility: edgeCase.visibility
    });
    validatePublicFields(edgeCase, publicFields);

    const objectPath = `edge-cases/${edgeCase.id}.png`;
    const poster = buildSharePosterBytes({
      publicFields,
      token: `edge_${edgeCase.id}`,
      objectPath
    });
    const pngInfo = readPngInfo(poster.bytes);
    const outputPath = path.join(outputDir, `share-edge-${edgeCase.id}.png`);
    writeFileSync(outputPath, poster.bytes);

    assert(pngInfo.width === SHARE_POSTER_WIDTH, `${edgeCase.id} poster width mismatch.`);
    assert(pngInfo.height === SHARE_POSTER_HEIGHT, `${edgeCase.id} poster height mismatch.`);
    assert(pngInfo.sampledColors >= 4, `${edgeCase.id} poster should not be visually blank.`);
    assert(poster.poster.mimeType === SHARE_POSTER_MIME_TYPE, `${edgeCase.id} poster MIME type mismatch.`);
    assert(poster.poster.byteSize === poster.bytes.byteLength, `${edgeCase.id} poster byte size mismatch.`);
    assert(/^[a-f0-9]{64}$/.test(poster.poster.sha256), `${edgeCase.id} poster SHA-256 digest missing.`);

    return {
      id: edgeCase.id,
      description: edgeCase.description,
      file: path.relative(repoRoot, outputPath).replace(/\\/g, "/"),
      byteSize: poster.poster.byteSize,
      width: pngInfo.width,
      height: pngInfo.height,
      sampledColors: pngInfo.sampledColors,
      publicFields: {
        independentScore: publicFields.independentScore,
        collaborativeScore: publicFields.collaborativeScore,
        totalScore: publicFields.totalScore,
        paperTitleLength: publicFields.paperTitle?.length ?? 0,
        regionLength: publicFields.region?.length ?? 0
      }
    };
  });
  const mobileShareViewportCss = validateShareViewportContract();
  const result = {
    ok: true,
    edgeCases: manifest,
    samplePoster: {
      file: "output/share-poster-sample.png",
      byteSize: samplePoster.poster.byteSize,
      width: samplePngInfo.width,
      height: samplePngInfo.height
    },
    mobileShareViewportCss,
    outputManifest: "output/share-edge-cases.json"
  };

  writeFileSync(path.join(outputDir, "share-edge-cases.json"), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
}

main();
