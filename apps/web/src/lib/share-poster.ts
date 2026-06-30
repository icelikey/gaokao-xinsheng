import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";

export const SHARE_POSTER_BUCKET = "share-cards";
export const SHARE_POSTER_WIDTH = 1080;
export const SHARE_POSTER_HEIGHT = 1440;
export const SHARE_POSTER_MIME_TYPE = "image/png";

export type SharePosterPublicFields = {
  title: string;
  paperTitle: string | null;
  region: string | null;
  independentScore: number | null;
  collaborativeScore: number | null;
  totalScore: number | null;
  aiHelpCount: number;
  reviewCount: number;
  disclaimer: string;
  visibility: {
    showIndependentScore: boolean;
    showCollaborativeScore: boolean;
    showPaperTitle: boolean;
    showRegion: boolean;
  };
};

export type SharePosterMetadata = {
  bucket: typeof SHARE_POSTER_BUCKET;
  objectPath: string;
  mimeType: typeof SHARE_POSTER_MIME_TYPE;
  width: typeof SHARE_POSTER_WIDTH;
  height: typeof SHARE_POSTER_HEIGHT;
  byteSize: number;
  sha256: string;
  alt: string;
};

type Rgba = [number, number, number, number];
type Canvas = {
  width: number;
  height: number;
  pixels: Buffer;
};

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const crcTable = buildCrcTable();
const font: Record<string, string[]> = {
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  "/": ["00001", "00010", "00100", "01000", "10000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "11100"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10011", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"]
};

export function buildSharePosterObjectPath(input: { reportId: string; token: string }) {
  return `${sanitizePathSegment(input.reportId)}/${sanitizePathSegment(input.token)}.png`;
}

export function buildSupabasePublicObjectUrl(input: { supabaseUrl: string; objectPath: string }) {
  const baseUrl = input.supabaseUrl.replace(/\/$/, "");
  const encodedPath = input.objectPath.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl}/storage/v1/object/public/${SHARE_POSTER_BUCKET}/${encodedPath}`;
}

export function buildLocalSharePoster(input: {
  reportId: string;
  token: string;
  publicFields: SharePosterPublicFields;
}) {
  const objectPath = buildSharePosterObjectPath(input);
  const bytes = renderSharePosterPng(input.publicFields, input.token);
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  return {
    objectUrl: `data:${SHARE_POSTER_MIME_TYPE};base64,${bytes.toString("base64")}`,
    poster: buildPosterMetadata({
      objectPath,
      bytes,
      sha256
    })
  };
}

export function buildSharePosterBytes(input: {
  publicFields: SharePosterPublicFields;
  token: string;
  objectPath: string;
}) {
  const bytes = renderSharePosterPng(input.publicFields, input.token);
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  return {
    bytes,
    poster: buildPosterMetadata({
      objectPath: input.objectPath,
      bytes,
      sha256
    })
  };
}

function buildPosterMetadata(input: { objectPath: string; bytes: Buffer; sha256: string }): SharePosterMetadata {
  return {
    bucket: SHARE_POSTER_BUCKET,
    objectPath: input.objectPath,
    mimeType: SHARE_POSTER_MIME_TYPE,
    width: SHARE_POSTER_WIDTH,
    height: SHARE_POSTER_HEIGHT,
    byteSize: input.bytes.byteLength,
    sha256: input.sha256,
    alt: "高考新生 AI 估分分享海报"
  };
}

function renderSharePosterPng(publicFields: SharePosterPublicFields, token: string) {
  const canvas = makeCanvas(SHARE_POSTER_WIDTH, SHARE_POSTER_HEIGHT, [247, 243, 234, 255]);
  const ink: Rgba = [15, 28, 46, 255];
  const muted: Rgba = [86, 102, 124, 255];
  const paper: Rgba = [255, 255, 255, 255];
  const blue: Rgba = [25, 79, 184, 255];
  const gold: Rgba = [210, 151, 57, 255];
  const green: Rgba = [41, 137, 111, 255];

  drawRect(canvas, 0, 0, SHARE_POSTER_WIDTH, 220, [9, 30, 58, 255]);
  drawRect(canvas, 0, 220, SHARE_POSTER_WIDTH, 24, gold);
  drawRect(canvas, 72, 92, 936, 1180, paper);
  drawBorder(canvas, 72, 92, 936, 1180, [207, 215, 226, 255], 4);
  drawRect(canvas, 112, 132, 856, 8, gold);

  drawText(canvas, "GAOKAO XINSHENG", 120, 174, 9, blue);
  drawText(canvas, "AI SCORE CARD", 120, 260, 6, muted);
  drawText(canvas, "NOT OFFICIAL SCORE", 120, 322, 4, gold);

  const independentText = formatScore(publicFields.independentScore, publicFields.totalScore);
  const collaborativeText = formatScore(publicFields.collaborativeScore, publicFields.totalScore);
  drawScorePanel(canvas, 120, 410, 400, 280, "INDEPENDENT", independentText, blue, publicFields.independentScore, publicFields.totalScore);
  drawScorePanel(canvas, 560, 410, 400, 280, "COLLABORATIVE", collaborativeText, green, publicFields.collaborativeScore, publicFields.totalScore);

  drawRect(canvas, 120, 760, 840, 220, [242, 246, 252, 255]);
  drawBorder(canvas, 120, 760, 840, 220, [211, 221, 235, 255], 3);
  drawText(canvas, "AI HELPS", 162, 820, 5, muted);
  drawText(canvas, String(publicFields.aiHelpCount), 162, 880, 8, blue);
  drawText(canvas, "REVIEW", 590, 820, 5, muted);
  drawText(canvas, String(publicFields.reviewCount), 590, 880, 8, gold);

  drawText(canvas, publicFields.paperTitle ? "PAPER SHOWN" : "PAPER HIDDEN", 162, 940, 4, muted);
  drawText(canvas, publicFields.region ? "REGION SHOWN" : "REGION HIDDEN", 590, 940, 4, muted);

  drawRect(canvas, 120, 1048, 840, 110, [9, 30, 58, 255]);
  drawText(canvas, `TOKEN ${token.slice(0, 12).toUpperCase()}`, 158, 1085, 5, [255, 255, 255, 255]);

  drawQrPlaceholder(canvas, 778, 1030, 142, ink, paper);
  drawText(canvas, "SHARE", 120, 1190, 4, muted);
  drawText(canvas, "RETAKE WITH EVIDENCE", 120, 1225, 5, ink);

  return encodePng(canvas.width, canvas.height, canvas.pixels);
}

function drawScorePanel(
  canvas: Canvas,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  scoreText: string,
  accent: Rgba,
  score: number | null,
  total: number | null
) {
  drawRect(canvas, x, y, width, height, [246, 248, 252, 255]);
  drawBorder(canvas, x, y, width, height, [213, 222, 233, 255], 3);
  drawText(canvas, label, x + 36, y + 40, 4, [86, 102, 124, 255]);
  drawText(canvas, scoreText, x + 36, y + 100, 8, accent);
  drawProgress(canvas, x + 36, y + height - 62, width - 72, 20, score, total, accent);
}

function makeCanvas(width: number, height: number, color: Rgba): Canvas {
  const pixels = Buffer.alloc(width * height * 4);
  const canvas = { width, height, pixels };
  drawRect(canvas, 0, 0, width, height, color);
  return canvas;
}

function drawRect(canvas: Canvas, x: number, y: number, width: number, height: number, color: Rgba) {
  const left = Math.max(0, Math.floor(x));
  const top = Math.max(0, Math.floor(y));
  const right = Math.min(canvas.width, Math.ceil(x + width));
  const bottom = Math.min(canvas.height, Math.ceil(y + height));

  for (let py = top; py < bottom; py += 1) {
    for (let px = left; px < right; px += 1) {
      setPixel(canvas, px, py, color);
    }
  }
}

function drawBorder(canvas: Canvas, x: number, y: number, width: number, height: number, color: Rgba, thickness: number) {
  drawRect(canvas, x, y, width, thickness, color);
  drawRect(canvas, x, y + height - thickness, width, thickness, color);
  drawRect(canvas, x, y, thickness, height, color);
  drawRect(canvas, x + width - thickness, y, thickness, height, color);
}

function drawProgress(
  canvas: Canvas,
  x: number,
  y: number,
  width: number,
  height: number,
  score: number | null,
  total: number | null,
  color: Rgba
) {
  drawRect(canvas, x, y, width, height, [220, 226, 235, 255]);
  const ratio = score !== null && total !== null && total > 0 ? Math.max(0, Math.min(1, score / total)) : 0;
  drawRect(canvas, x, y, Math.max(4, Math.round(width * ratio)), height, color);
}

function formatScore(score: number | null, total: number | null) {
  if (score === null || total === null) {
    return "HIDDEN";
  }

  return `${Math.round(score)}/${Math.round(total)}`;
}

function drawQrPlaceholder(canvas: Canvas, x: number, y: number, size: number, color: Rgba, background: Rgba) {
  drawRect(canvas, x, y, size, size, background);
  drawBorder(canvas, x, y, size, size, color, 6);
  const cell = Math.floor(size / 9);
  const pattern = [
    "111000111",
    "101010101",
    "111011111",
    "000110000",
    "101111010",
    "000011000",
    "111010111",
    "101110101",
    "111000111"
  ];

  pattern.forEach((row, rowIndex) => {
    [...row].forEach((value, columnIndex) => {
      if (value === "1") {
        drawRect(canvas, x + 10 + columnIndex * cell, y + 10 + rowIndex * cell, cell - 2, cell - 2, color);
      }
    });
  });
}

function drawText(canvas: Canvas, text: string, x: number, y: number, scale: number, color: Rgba) {
  let cursorX = x;
  for (const character of text.toUpperCase()) {
    const glyph = font[character] ?? font[" "];
    glyph.forEach((row, rowIndex) => {
      [...row].forEach((pixel, columnIndex) => {
        if (pixel === "1") {
          drawRect(canvas, cursorX + columnIndex * scale, y + rowIndex * scale, scale, scale, color);
        }
      });
    });
    cursorX += 6 * scale;
  }
}

function setPixel(canvas: Canvas, x: number, y: number, color: Rgba) {
  const index = (y * canvas.width + x) * 4;
  canvas.pixels[index] = color[0];
  canvas.pixels[index + 1] = color[1];
  canvas.pixels[index + 2] = color[2];
  canvas.pixels[index + 3] = color[3];
}

function encodePng(width: number, height: number, rgba: Buffer) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rawOffset = y * (width * 4 + 1);
    raw[rawOffset] = 0;
    rgba.copy(raw, rawOffset + 1, y * width * 4, (y + 1) * width * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    pngSignature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function pngChunk(type: string, data: Buffer) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function buildCrcTable() {
  const table: number[] = [];
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
}
