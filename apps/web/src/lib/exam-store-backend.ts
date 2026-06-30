import type {
  AnswerPayload,
  ExamMode,
  PaperImportPayload,
  ReviewActionRequest,
  ReviewScoreAdjustmentRequest,
  ShareVisibility
} from "@gaokao-xinsheng/contracts";
import type { PaperImportConflictPolicy } from "./paper-import";
import { getRuntimeConfig } from "./runtime-config";
import * as memoryStore from "./exam-store";
import { StoreBackendError, isStoreBackendError } from "./store-backend-error";
import * as supabaseStore from "./supabase-exam-store";

export { StoreBackendError, isStoreBackendError };

function getSelectedBackend() {
  const config = getRuntimeConfig();

  if (config.examStoreBackend === "memory") {
    return memoryStore;
  }

  if (config.hasSupabaseStoreAdapterEnabled) {
    return supabaseStore;
  }

  throw new StoreBackendError(
    "SUPABASE_STORE_ADAPTER_PENDING",
    "EXAM_STORE_BACKEND=supabase is configured, but SUPABASE_STORE_ADAPTER_ENABLED is not true."
  );
}

export async function createExamSession(input: {
  paperId: string;
  mode: ExamMode;
  settings: memoryStore.ExamSessionRecord["settings"];
}) {
  return getSelectedBackend().createExamSession(input);
}

export async function getExamSession(sessionId: string) {
  return getSelectedBackend().getExamSession(sessionId);
}

export async function startExamSession(sessionId: string) {
  return getSelectedBackend().startExamSession(sessionId);
}

export async function saveAnswer(input: {
  sessionId: string;
  questionId: string;
  answer: AnswerPayload;
  clientVersion: number;
}) {
  return getSelectedBackend().saveAnswer(input);
}

export async function requestAiHelp(input: {
  sessionId: string;
  questionId: string;
  level: number;
}) {
  return getSelectedBackend().requestAiHelp(input);
}

export async function submitExamSession(input: {
  sessionId: string;
  idempotencyKey: string;
}) {
  return getSelectedBackend().submitExamSession(input);
}

export async function getExamReport(reportId: string) {
  return getSelectedBackend().getExamReport(reportId);
}

export async function getGradingJob(jobId: string) {
  return getSelectedBackend().getGradingJob(jobId);
}

export async function createShareCard(input: {
  reportId: string;
  idempotencyKey: string;
  visibility?: ShareVisibility;
}) {
  return getSelectedBackend().createShareCard(input);
}

export async function getShareCardByToken(token: string) {
  return getSelectedBackend().getShareCardByToken(token);
}

export async function createPaperImport(input: {
  paper: PaperImportPayload;
  dryRun?: boolean;
  conflictPolicy?: PaperImportConflictPolicy;
  actor?: string;
}) {
  return getSelectedBackend().createPaperImport(input);
}

export async function getImportedPaper(paperId: string) {
  const backend = getSelectedBackend();

  return "getImportedPaper" in backend ? backend.getImportedPaper(paperId) : null;
}

export async function listReviewQueue() {
  return getSelectedBackend().listReviewQueue();
}

export async function updateReviewQueueItem(input: {
  reportId: string;
  action: ReviewActionRequest["action"];
  actor?: string;
  note?: string;
}) {
  return getSelectedBackend().updateReviewQueueItem(input);
}

export async function adjustReportQuestionScore(input: {
  reportId: string;
  questionId: string;
  score: ReviewScoreAdjustmentRequest["score"];
  actor?: string;
  reason: ReviewScoreAdjustmentRequest["reason"];
}) {
  return getSelectedBackend().adjustReportQuestionScore(input);
}
