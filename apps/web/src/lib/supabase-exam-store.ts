import {
  type AnswerPayload,
  type ExamMode,
  type ExamSessionState,
  type PaperImportPayload,
  type ReviewActionRequest,
  type ReviewScoreAdjustmentRequest,
  type ShareVisibility,
  type MvpQuestion,
  getMvpPaper
} from "@gaokao-xinsheng/contracts";
import { buildTutorHint } from "@gaokao-xinsheng/ai-tutor";
import { gradePaper, type GradingConfidence } from "@gaokao-xinsheng/grader";
import { StoreBackendError } from "./store-backend-error";
import { supabasePublicStorageUrl, supabaseRest, supabaseRpc, supabaseStorageUpload } from "./supabase-server";
import {
  buildSharePosterBytes,
  buildSharePosterObjectPath,
  SHARE_POSTER_BUCKET,
  SHARE_POSTER_MIME_TYPE,
  type SharePosterMetadata
} from "./share-poster";
import {
  buildSharePublicFields,
  type AiHelpRecord,
  type AnswerVersionRecord,
  type ExamReportRecord,
  type ExamSessionRecord,
  type GradingJobRecord,
  type ReportQuestion,
  type ReviewActionResult,
  type ReviewQueueItem,
  type ReviewScoreAdjustmentResult,
  type ReviewStatus,
  type ShareCardRecord
} from "./exam-store";
import {
  buildPaperImportBatch,
  summarizePaperImportSections,
  type PaperImportBatchRecord,
  type PaperImportConflictPolicy
} from "./paper-import";

type UserRow = {
  id: string;
  openid_hash: string | null;
  status: string;
  created_at: string;
};

type ExamSessionRow = {
  id: string;
  user_id: string;
  paper_id: string;
  mode: ExamMode;
  state: ExamSessionState;
  settings: ExamSessionRecord["settings"];
  start_at: string | null;
  deadline_at: string | null;
  submitted_version_id: string | null;
  created_at: string;
  updated_at: string;
};

type AnswerVersionRow = {
  id: string;
  session_id: string;
  question_id: string;
  content_json: AnswerPayload;
  client_version: number;
  server_version: number;
  created_at: string;
};

type AiHelpEventRow = {
  id: string;
  question_id: string;
  level: number;
  pre_ai_version_id: string | null;
  output_json: {
    message: string;
    knowledgePoints?: string[];
    suggestedNextAction?: string;
    safetyFlags?: string[];
  };
  reveals_final_answer: boolean;
  created_at: string;
};

type GradingJobRow = {
  id: string;
  session_id: string;
  state: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "RETRYING";
  idempotency_key: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

type GradingResultRow = {
  question_id: string;
  answer_version_id: string;
  score: number;
  max_score: number;
  confidence: number;
  evidence: {
    confidence?: GradingConfidence;
    evidence?: string;
    requiresReview?: boolean;
    rubricScores?: unknown[];
  };
};

type ExamReportRow = {
  id: string;
  session_id: string;
  grading_job_id: string;
  independent_score: number;
  collaborative_score: number;
  summary: {
    aiHelpCount?: number;
    lowConfidenceCount?: number;
    reviewCount?: number;
    totalScore?: number;
  };
  created_at: string;
};

type ShareCardRow = {
  id: string;
  report_id: string;
  template: "mvp-score-card";
  public_fields: ShareCardRecord["publicFields"];
  object_url: string | null;
  token: string;
  created_at: string;
};

type PaperImportBatchRow = {
  id: string;
  paper_id: string;
  title: string;
  actor: string;
  dry_run: boolean;
  conflict_policy: PaperImportConflictPolicy;
  status: PaperImportBatchRecord["status"];
  payload_hash: string;
  summary: PaperImportBatchRecord["summary"];
  commit_summary: PaperImportBatchRecord["commitSummary"];
  issues: PaperImportBatchRecord["issues"];
  created_at: string;
};

type ImportedSectionRow = {
  id: string;
  paper_id: string;
  title: string;
  order_no: number;
  max_score: number;
};

type ReviewQueueRow = {
  grading_job_id: string;
  report_id: string;
  session_id: string;
  review_status: ReviewStatus;
  assignee: string | null;
  reviewer_note: string | null;
  audit_count: number;
  review_count: number;
  low_confidence_count: number;
  collaborative_score: number;
  total_score: number;
  created_at: string;
  updated_at: string;
};

type ReviewTaskRow = {
  report_id: string;
  grading_job_id: string;
  status: ReviewStatus;
  assignee: string | null;
  reviewer_note: string | null;
  resolved_at: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
};

type AuditLogRow = {
  id: string;
  actor: string;
  action: string;
  target: string;
  before: {
    reviewStatus?: ReviewStatus;
    score?: number;
  } | null;
  after: {
    reviewStatus?: ReviewStatus;
    note?: string | null;
    score?: number;
    questionId?: string;
  } | null;
  created_at: string;
};

const previewUserHash = "local-preview-user";

function nowIso() {
  return new Date().toISOString();
}

async function hashJson(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function confidenceToNumeric(confidence: GradingConfidence) {
  return confidence === "high" ? 0.95 : confidence === "medium" ? 0.7 : 0.4;
}

function confidenceFromResult(row: GradingResultRow): GradingConfidence {
  if (row.evidence.confidence) {
    return row.evidence.confidence;
  }

  return row.confidence >= 0.85 ? "high" : row.confidence >= 0.6 ? "medium" : "low";
}

function blankAnswer(question: MvpQuestion): AnswerPayload {
  if (question.type === "single_choice") {
    return {
      type: "single_choice",
      value: ""
    };
  }

  return {
    type: question.type,
    value: ""
  } as AnswerPayload;
}

function nextReviewStatus(action: ReviewActionRequest["action"]): ReviewStatus {
  if (action === "ASSIGN") {
    return "ASSIGNED";
  }

  return action === "RESOLVE" ? "RESOLVED" : "REJECTED";
}

function isReviewNeeded(report: ExamReportRecord) {
  return report.reviewCount > 0 || report.lowConfidenceCount > 0;
}

function mapAnswerVersion(row: AnswerVersionRow): AnswerVersionRecord {
  return {
    id: row.id,
    questionId: row.question_id,
    answer: row.content_json,
    clientVersion: row.client_version,
    serverVersion: row.server_version,
    createdAt: row.created_at
  };
}

function mapAiEvent(row: AiHelpEventRow): AiHelpRecord {
  return {
    id: row.id,
    questionId: row.question_id,
    level: row.level,
    preAiVersionId: row.pre_ai_version_id,
    message: row.output_json.message,
    knowledgePoints: row.output_json.knowledgePoints ?? [],
    suggestedNextAction: row.output_json.suggestedNextAction ?? "",
    revealsFinalAnswer: row.reveals_final_answer,
    safetyFlags: row.output_json.safetyFlags ?? [],
    createdAt: row.created_at
  };
}

async function selectOne<T>(table: string, query: Record<string, string | number | boolean | undefined>) {
  const rows = await supabaseRest<T[]>(table, {
    query: {
      select: "*",
      limit: 1,
      ...query
    }
  });

  return rows[0] ?? null;
}

async function ensurePreviewUser() {
  const rows = await supabaseRest<UserRow[]>("users", {
    method: "POST",
    query: {
      on_conflict: "openid_hash"
    },
    prefer: "resolution=merge-duplicates,return=representation",
    body: {
      openid_hash: previewUserHash,
      status: "active"
    }
  });

  const user = rows[0];

  if (!user) {
    throw new StoreBackendError("SUPABASE_USER_UPSERT_FAILED", "Unable to create preview user in Supabase.", 500);
  }

  return user;
}

async function fetchSessionRow(sessionId: string) {
  return selectOne<ExamSessionRow>("exam_sessions", {
    id: `eq.${sessionId}`
  });
}

async function fetchAnswerVersions(sessionId: string) {
  return supabaseRest<AnswerVersionRow[]>("answer_versions", {
    query: {
      select: "*",
      session_id: `eq.${sessionId}`,
      order: "server_version.asc"
    }
  });
}

async function fetchAiEvents(sessionId: string) {
  return supabaseRest<AiHelpEventRow[]>("ai_help_events", {
    query: {
      select: "*",
      session_id: `eq.${sessionId}`,
      order: "created_at.asc"
    }
  });
}

function latestAnswerMap(answerVersions: AnswerVersionRow[]) {
  return answerVersions.reduce<Record<string, AnswerVersionRow>>((latest, row) => {
    latest[row.question_id] = row;
    return latest;
  }, {});
}

function independentAnswerMap(input: {
  questions: MvpQuestion[];
  latestRows: Record<string, AnswerVersionRow>;
  answerRowsById: Record<string, AnswerVersionRow>;
  aiEvents: AiHelpRecord[];
}) {
  return Object.fromEntries(
    input.questions.map((question) => {
      const firstAiEvent = input.aiEvents.find((event) => event.questionId === question.id && event.preAiVersionId);
      const preAiRow = firstAiEvent?.preAiVersionId ? input.answerRowsById[firstAiEvent.preAiVersionId] : null;
      const answer = preAiRow?.content_json ?? input.latestRows[question.id]?.content_json ?? null;

      return [question.id, answer];
    })
  );
}

async function fetchLatestJob(sessionId: string) {
  return selectOne<GradingJobRow>("grading_jobs", {
    session_id: `eq.${sessionId}`,
    order: "created_at.desc"
  });
}

async function fetchReportBySession(sessionId: string) {
  return selectOne<ExamReportRow>("exam_reports", {
    session_id: `eq.${sessionId}`
  });
}

async function fetchReportByJob(jobId: string) {
  return selectOne<ExamReportRow>("exam_reports", {
    grading_job_id: `eq.${jobId}`
  });
}

async function mapSession(row: ExamSessionRow): Promise<ExamSessionRecord> {
  const [answers, aiEvents, latestJob, report] = await Promise.all([
    fetchAnswerVersions(row.id),
    fetchAiEvents(row.id),
    fetchLatestJob(row.id),
    fetchReportBySession(row.id)
  ]);
  const groupedAnswers = answers.reduce<Record<string, AnswerVersionRecord[]>>((grouped, answer) => {
    grouped[answer.question_id] = [...(grouped[answer.question_id] ?? []), mapAnswerVersion(answer)];
    return grouped;
  }, {});

  return {
    id: row.id,
    userId: row.user_id,
    paperId: row.paper_id,
    mode: row.mode,
    state: row.state,
    settings: row.settings,
    serverVersion: answers.at(-1)?.server_version ?? 0,
    startAt: row.start_at,
    deadlineAt: row.deadline_at,
    submittedAt: row.state === "GRADED" || row.state === "SUBMITTED" ? row.updated_at : null,
    submittedVersionId: row.submitted_version_id,
    gradingJobId: latestJob?.id ?? null,
    reportId: report?.id ?? null,
    answers: groupedAnswers,
    aiHelpEvents: aiEvents.map(mapAiEvent),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function insertAnswerVersion(input: {
  session: ExamSessionRecord;
  questionId: string;
  answer: AnswerPayload;
  clientVersion: number;
}) {
  const serverVersion = input.session.serverVersion + 1;
  const rows = await supabaseRest<AnswerVersionRow[]>("answer_versions", {
    method: "POST",
    prefer: "return=representation",
    body: {
      session_id: input.session.id,
      question_id: input.questionId,
      content_json: input.answer,
      source: "user",
      client_version: input.clientVersion,
      server_version: serverVersion,
      content_hash: await hashJson(input.answer)
    }
  });
  const version = rows[0];

  if (!version) {
    throw new StoreBackendError("SUPABASE_ANSWER_INSERT_FAILED", "Unable to save answer version.", 500);
  }

  await supabaseRest<ExamSessionRow[]>("exam_sessions", {
    method: "PATCH",
    query: {
      id: `eq.${input.session.id}`
    },
    prefer: "return=representation",
    body: {
      state: "IN_PROGRESS",
      updated_at: version.created_at
    }
  });

  return version;
}

export async function createExamSession(input: {
  paperId: string;
  mode: ExamMode;
  settings: ExamSessionRecord["settings"];
}) {
  const paper = getMvpPaper(input.paperId);

  if (!paper) {
    return null;
  }

  const user = await ensurePreviewUser();
  const rows = await supabaseRest<ExamSessionRow[]>("exam_sessions", {
    method: "POST",
    prefer: "return=representation",
    body: {
      user_id: user.id,
      paper_id: paper.id,
      mode: input.mode,
      state: "CREATED",
      settings: input.settings
    }
  });
  const session = rows[0];

  return session ? mapSession(session) : null;
}

export async function getExamSession(sessionId: string) {
  const session = await fetchSessionRow(sessionId);
  return session ? mapSession(session) : null;
}

export async function startExamSession(sessionId: string) {
  const current = await fetchSessionRow(sessionId);

  if (!current) {
    return null;
  }

  if (current.state === "CREATED" || current.state === "READY") {
    const paper = getMvpPaper(current.paper_id);
    const startAt = nowIso();
    const deadlineAt = new Date(Date.parse(startAt) + (paper?.durationMinutes ?? 15) * 60 * 1000).toISOString();
    const rows = await supabaseRest<ExamSessionRow[]>("exam_sessions", {
      method: "PATCH",
      query: {
        id: `eq.${sessionId}`
      },
      prefer: "return=representation",
      body: {
        state: "IN_PROGRESS",
        start_at: startAt,
        deadline_at: deadlineAt,
        updated_at: startAt
      }
    });

    return rows[0] ? mapSession(rows[0]) : null;
  }

  return mapSession(current);
}

export async function saveAnswer(input: {
  sessionId: string;
  questionId: string;
  answer: AnswerPayload;
  clientVersion: number;
}) {
  const session = await getExamSession(input.sessionId);

  if (!session || session.state === "SUBMITTED" || session.state === "GRADING" || session.state === "GRADED") {
    return null;
  }

  const answerVersion = await insertAnswerVersion({
    session,
    questionId: input.questionId,
    answer: input.answer,
    clientVersion: input.clientVersion
  });
  const updatedSession = await getExamSession(input.sessionId);

  return updatedSession
    ? {
        session: updatedSession,
        answerVersion: mapAnswerVersion(answerVersion)
      }
    : null;
}

export async function requestAiHelp(input: {
  sessionId: string;
  questionId: string;
  level: number;
}) {
  const session = await getExamSession(input.sessionId);
  const paper = session ? getMvpPaper(session.paperId) ?? null : null;
  const question = paper?.questions.find((item) => item.id === input.questionId);

  if (!session || !question) {
    return null;
  }

  let preAiVersion = session.answers[question.id]?.at(-1) ?? null;

  if (!preAiVersion) {
    const saved = await saveAnswer({
      sessionId: session.id,
      questionId: question.id,
      answer: blankAnswer(question),
      clientVersion: 0
    });
    preAiVersion = saved?.answerVersion ?? null;
  }

  const hint = buildTutorHint({
    question,
    level: input.level,
    userAnswer: preAiVersion?.answer ?? null
  });
  const rows = await supabaseRest<AiHelpEventRow[]>("ai_help_events", {
    method: "POST",
    prefer: "return=representation",
    body: {
      session_id: session.id,
      question_id: question.id,
      level: hint.level,
      pre_ai_version_id: preAiVersion?.id ?? null,
      output_json: {
        message: hint.revealsFinalAnswer ? "本级提示被安全规则拦截，请先从题意和条件开始。" : hint.message,
        knowledgePoints: hint.knowledgePoints,
        suggestedNextAction: hint.suggestedNextAction,
        safetyFlags: hint.safetyFlags
      },
      reveals_final_answer: hint.revealsFinalAnswer
    }
  });
  const event = rows[0];

  return event
    ? {
        event: mapAiEvent(event),
        preAiAnswerVersionId: event.pre_ai_version_id
      }
    : null;
}

export async function submitExamSession(input: {
  sessionId: string;
  idempotencyKey: string;
}) {
  const existingJob = await selectOne<GradingJobRow>("grading_jobs", {
    session_id: `eq.${input.sessionId}`,
    idempotency_key: `eq.${input.idempotencyKey}`
  });

  if (existingJob) {
    const existingReport = await fetchReportByJob(existingJob.id);
    return existingReport ? getExamReport(existingReport.id) : null;
  }

  const session = await getExamSession(input.sessionId);
  const paper = session ? getMvpPaper(session.paperId) ?? null : null;

  if (!session || !paper) {
    return null;
  }

  for (const question of paper.questions) {
    if (!session.answers[question.id]?.at(-1)) {
      await saveAnswer({
        sessionId: session.id,
        questionId: question.id,
        answer: blankAnswer(question),
        clientVersion: 0
      });
    }
  }

  const submittedSession = await getExamSession(input.sessionId);

  if (!submittedSession) {
    return null;
  }

  const answerRows = await fetchAnswerVersions(input.sessionId);
  const latestRows = latestAnswerMap(answerRows);
  const answerRowsById = Object.fromEntries(answerRows.map((row) => [row.id, row]));
  const latestAnswers = Object.fromEntries(
    paper.questions.map((question) => [question.id, latestRows[question.id]?.content_json ?? null])
  );
  const independentAnswers = independentAnswerMap({
    questions: paper.questions,
    latestRows,
    answerRowsById,
    aiEvents: submittedSession.aiHelpEvents
  });
  const submittedVersionId = Object.values(latestRows).at(-1)?.id ?? null;
  const startedAt = nowIso();
  const gradingJobRows = await supabaseRest<GradingJobRow[]>("grading_jobs", {
    method: "POST",
    prefer: "return=representation",
    body: {
      session_id: input.sessionId,
      state: "RUNNING",
      idempotency_key: input.idempotencyKey,
      started_at: startedAt
    }
  });
  const gradingJob = gradingJobRows[0];

  if (!gradingJob) {
    throw new StoreBackendError("SUPABASE_GRADING_JOB_INSERT_FAILED", "Unable to create grading job.", 500);
  }

  await supabaseRpc<number>("enqueue_grading_job", {
    p_job_id: gradingJob.id,
    p_session_id: input.sessionId
  }).catch(() => null);

  const graded = gradePaper({
    paper,
    answers: latestAnswers
  });
  const independentGraded = gradePaper({
    paper,
    answers: independentAnswers
  });
  const gradingResults = graded.results.map((result) => ({
    job_id: gradingJob.id,
    question_id: result.questionId,
    answer_version_id: latestRows[result.questionId].id,
    score: result.score,
    max_score: result.maxScore,
    confidence: confidenceToNumeric(result.confidence),
    evidence: {
      confidence: result.confidence,
      evidence: result.evidence,
      requiresReview: result.requiresReview,
      rubricScores: result.rubricScores
    }
  }));

  await supabaseRest<GradingResultRow[]>("grading_results", {
    method: "POST",
    prefer: "return=representation",
    body: gradingResults
  });

  const completedAt = nowIso();
  await supabaseRest<GradingJobRow[]>("grading_jobs", {
    method: "PATCH",
    query: {
      id: `eq.${gradingJob.id}`
    },
    prefer: "return=representation",
    body: {
      state: "SUCCEEDED",
      completed_at: completedAt
    }
  });

  const reportRows = await supabaseRest<ExamReportRow[]>("exam_reports", {
    method: "POST",
    prefer: "return=representation",
    body: {
      session_id: input.sessionId,
      grading_job_id: gradingJob.id,
      independent_score: independentGraded.score,
      collaborative_score: graded.score,
      summary: {
        aiHelpCount: submittedSession.aiHelpEvents.length,
        lowConfidenceCount: graded.lowConfidenceCount,
        reviewCount: graded.reviewCount,
        totalScore: paper.totalScore
      }
    }
  });
  const report = reportRows[0];

  await supabaseRest<ExamSessionRow[]>("exam_sessions", {
    method: "PATCH",
    query: {
      id: `eq.${input.sessionId}`
    },
    prefer: "return=representation",
    body: {
      state: "GRADED",
      submitted_version_id: submittedVersionId,
      updated_at: completedAt
    }
  });

  return report ? getExamReport(report.id) : null;
}

export async function getExamReport(reportId: string) {
  const report = await selectOne<ExamReportRow>("exam_reports", {
    id: `eq.${reportId}`
  });

  if (!report) {
    return null;
  }

  const session = await getExamSession(report.session_id);
  const paper = session ? getMvpPaper(session.paperId) : null;

  if (!session || !paper) {
    return null;
  }

  const results = await supabaseRest<GradingResultRow[]>("grading_results", {
    query: {
      select: "*",
      job_id: `eq.${report.grading_job_id}`
    }
  });
  const resultMap = Object.fromEntries(results.map((item) => [item.question_id, item]));
  const answerRows = await fetchAnswerVersions(report.session_id);
  const latestRows = latestAnswerMap(answerRows);
  const answerRowsById = Object.fromEntries(answerRows.map((row) => [row.id, row]));
  const independentAnswers = independentAnswerMap({
    questions: paper.questions,
    latestRows,
    answerRowsById,
    aiEvents: session.aiHelpEvents
  });
  const independentResults = gradePaper({
    paper,
    answers: independentAnswers
  }).results;
  const independentResultMap = Object.fromEntries(independentResults.map((item) => [item.questionId, item]));
  const questions = paper.questions.map<ReportQuestion>((question) => {
    const result = resultMap[question.id];
    const independentResult = independentResultMap[question.id];

    return {
      questionId: question.id,
      orderNo: question.orderNo,
      type: question.type,
      stem: question.stem,
      userAnswer: session.answers[question.id]?.at(-1)?.answer ?? null,
      correctAnswer: question.answer,
      independentScore: independentResult?.score ?? 0,
      collaborativeScore: result?.score ?? 0,
      score: result?.score ?? 0,
      maxScore: question.maxScore,
      confidence: result ? confidenceFromResult(result) : "low",
      requiresReview: result?.evidence.requiresReview ?? true,
      evidence: result?.evidence.evidence ?? "评分结果缺失，需要复核。"
    };
  });

  return {
    id: report.id,
    sessionId: report.session_id,
    gradingJobId: report.grading_job_id,
    independentScore: report.independent_score,
    collaborativeScore: report.collaborative_score,
    totalScore: report.summary.totalScore ?? paper.totalScore,
    aiHelpCount: report.summary.aiHelpCount ?? session.aiHelpEvents.length,
    lowConfidenceCount: report.summary.lowConfidenceCount ?? 0,
    reviewCount: report.summary.reviewCount ?? 0,
    questions,
    createdAt: report.created_at
  } satisfies ExamReportRecord;
}

export async function getGradingJob(jobId: string) {
  const job = await selectOne<GradingJobRow>("grading_jobs", {
    id: `eq.${jobId}`
  });

  if (!job) {
    return null;
  }

  const report = await fetchReportByJob(job.id);

  return {
    id: job.id,
    sessionId: job.session_id,
    state: job.state === "RETRYING" ? "RUNNING" : job.state,
    idempotencyKey: job.idempotency_key,
    reportId: report?.id ?? null,
    lowConfidenceCount: report?.summary.lowConfidenceCount ?? 0,
    reviewCount: report?.summary.reviewCount ?? 0,
    startedAt: job.started_at,
    completedAt: job.completed_at,
    createdAt: job.created_at
  } satisfies GradingJobRecord;
}

export async function createShareCard(input: {
  reportId: string;
  idempotencyKey: string;
  visibility?: ShareVisibility;
}) {
  const existing = await selectOne<ShareCardRow>("share_cards", {
    report_id: `eq.${input.reportId}`,
    idempotency_key: `eq.${input.idempotencyKey}`
  });

  if (existing) {
    return mapShareCard(existing);
  }

  const report = await getExamReport(input.reportId);

  if (!report) {
    return null;
  }

  const token = `sharetoken_${crypto.randomUUID()}`;
  const session = await getExamSession(report.sessionId);
  const paper = session ? getMvpPaper(session.paperId) ?? null : null;
  const publicFields = buildSharePublicFields({
    report,
    paper,
    visibility: input.visibility
  });
  const objectPath = buildSharePosterObjectPath({
    reportId: report.id,
    token
  });
  const posterBytes = buildSharePosterBytes({
    publicFields,
    token,
    objectPath
  });
  await supabaseStorageUpload({
    bucket: SHARE_POSTER_BUCKET,
    objectPath,
    body: posterBytes.bytes,
    contentType: SHARE_POSTER_MIME_TYPE
  });
  const objectUrl = supabasePublicStorageUrl(SHARE_POSTER_BUCKET, objectPath);
  const rows = await supabaseRest<ShareCardRow[]>("share_cards", {
    method: "POST",
    prefer: "return=representation",
    body: {
      report_id: report.id,
      idempotency_key: input.idempotencyKey,
      template: "mvp-score-card",
      token,
      object_url: objectUrl,
      public_fields: publicFields
    }
  });

  return rows[0] ? mapShareCard(rows[0], posterBytes.poster) : null;
}

function mapShareCard(row: ShareCardRow, poster?: SharePosterMetadata): ShareCardRecord {
  const objectUrl = row.object_url ?? "";
  const objectPath = poster?.objectPath ?? objectUrl.split(`/storage/v1/object/public/${SHARE_POSTER_BUCKET}/`)[1] ?? "";

  return {
    id: row.id,
    reportId: row.report_id,
    token: row.token,
    template: row.template,
    objectUrl,
    poster: poster ?? {
      bucket: SHARE_POSTER_BUCKET,
      objectPath,
      mimeType: SHARE_POSTER_MIME_TYPE,
      width: 1080,
      height: 1440,
      byteSize: 0,
      sha256: "",
      alt: "高考新生 AI 估分分享海报"
    },
    publicFields: row.public_fields,
    createdAt: row.created_at
  };
}

export async function getShareCardByToken(token: string) {
  const shareCard = await selectOne<ShareCardRow>("share_cards", {
    token: `eq.${token}`
  });

  return shareCard ? mapShareCard(shareCard) : null;
}

async function commitImportedPaper(input: {
  paper: PaperImportPayload;
  batch: PaperImportBatchRecord;
}) {
  if (!input.batch.commitSummary.committed) {
    return input.batch.commitSummary;
  }

  await supabaseRest("papers", {
    method: "POST",
    query: {
      on_conflict: "id"
    },
    prefer: "resolution=merge-duplicates,return=representation",
    body: {
      id: input.paper.id,
      title: input.paper.title,
      year: input.paper.year,
      region: input.paper.region,
      track: input.paper.track,
      subject: input.paper.subject,
      paper_type: input.paper.paperType,
      total_score: input.paper.totalScore,
      duration_minutes: input.paper.durationMinutes,
      status: input.paper.status ?? "PREVIEW",
      updated_at: input.batch.createdAt
    }
  });

  const sections = summarizePaperImportSections(input.paper);
  const sectionRows = await supabaseRest<ImportedSectionRow[]>("sections", {
    method: "POST",
    query: {
      on_conflict: "paper_id,order_no"
    },
    prefer: "resolution=merge-duplicates,return=representation",
    body: sections.map((section) => ({
      paper_id: input.paper.id,
      title: section.title,
      order_no: section.orderNo,
      max_score: section.maxScore
    }))
  });
  const sectionIdByTitle = new Map(sectionRows.map((section) => [section.title, section.id]));

  await supabaseRest("questions", {
    method: "POST",
    query: {
      on_conflict: "id"
    },
    prefer: "resolution=merge-duplicates,return=representation",
    body: input.paper.questions.map((question) => ({
      id: question.id,
      paper_id: input.paper.id,
      section_id: sectionIdByTitle.get(question.section) ?? null,
      order_no: question.orderNo,
      type: question.type,
      stem_json: [
        {
          type: "paragraph",
          text: question.stem
        }
      ],
      input_schema: question.options ? { options: question.options } : {},
      max_score: question.maxScore,
      version: 1,
      status: "active"
    }))
  });

  await supabaseRest("answer_keys", {
    method: "POST",
    query: {
      on_conflict: "question_id,version"
    },
    prefer: "resolution=merge-duplicates,return=representation",
    body: input.paper.questions.map((question) => ({
      question_id: question.id,
      version: 1,
      canonical_answer: {
        value: question.answer
      },
      equivalence_rules: {
        conflictPolicy: input.batch.conflictPolicy,
        importBatchId: input.batch.id
      }
    }))
  });

  const rubricRows = input.paper.questions
    .filter((question) => question.rubric?.length)
    .map((question) => ({
      question_id: question.id,
      version: 1,
      rubric_items_json: question.rubric?.map((item) => ({
        rubric_id: item.id,
        name: item.name,
        score: item.score
      }))
    }));

  if (rubricRows.length > 0) {
    await supabaseRest("grading_rubrics", {
      method: "POST",
      query: {
        on_conflict: "question_id,version"
      },
      prefer: "resolution=merge-duplicates,return=representation",
      body: rubricRows
    });
  }

  return input.batch.commitSummary;
}

export async function createPaperImport(input: {
  paper: PaperImportPayload;
  dryRun?: boolean;
  conflictPolicy?: PaperImportConflictPolicy;
  actor?: string;
}) {
  const batch = buildPaperImportBatch({
    id: crypto.randomUUID(),
    paper: input.paper,
    dryRun: input.dryRun ?? true,
    conflictPolicy: input.conflictPolicy,
    actor: input.actor,
    createdAt: nowIso()
  });
  const commitSummary = await commitImportedPaper({
    paper: input.paper,
    batch
  });
  const rows = await supabaseRest<PaperImportBatchRow[]>("paper_import_batches", {
    method: "POST",
    prefer: "return=representation",
    body: {
      id: batch.id,
      paper_id: batch.paperId,
      title: batch.title,
      actor: batch.actor,
      dry_run: batch.dryRun,
      conflict_policy: batch.conflictPolicy,
      status: batch.status,
      payload_hash: batch.payloadHash,
      summary: batch.summary,
      commit_summary: commitSummary,
      issues: batch.issues,
      created_at: batch.createdAt
    }
  });
  const row = rows[0];

  if (!row) {
    throw new StoreBackendError("SUPABASE_PAPER_IMPORT_FAILED", "Unable to record the paper import batch.", 500);
  }

  await supabaseRest<AuditLogRow[]>("audit_logs", {
    method: "POST",
    prefer: "return=representation",
    body: {
      actor: batch.actor,
      action: batch.auditAction,
      target: `paper:${batch.paperId}`,
      before: null,
      after: {
        batchId: row.id,
        status: row.status,
        dryRun: row.dry_run,
        conflictPolicy: row.conflict_policy,
        commitSummary: row.commit_summary,
        issueCount: row.issues.length,
        payloadHash: row.payload_hash
      }
    }
  });

  return {
    id: row.id,
    paperId: row.paper_id,
    title: row.title,
    dryRun: row.dry_run,
    conflictPolicy: row.conflict_policy,
    actor: row.actor,
    status: row.status,
    payloadHash: row.payload_hash,
    summary: row.summary,
    commitSummary: row.commit_summary,
    issues: row.issues,
    auditAction: batch.auditAction,
    createdAt: row.created_at
  } satisfies PaperImportBatchRecord;
}

export async function listReviewQueue() {
  const rows = await supabaseRest<ReviewQueueRow[]>("review_queue", {
    query: {
      select: "*",
      order: "created_at.desc"
    }
  });

  return rows.map<ReviewQueueItem>((item) => ({
    gradingJobId: item.grading_job_id,
    reportId: item.report_id,
    sessionId: item.session_id,
    reviewStatus: item.review_status,
    assignee: item.assignee,
    reviewerNote: item.reviewer_note,
    auditCount: item.audit_count,
    reviewCount: item.review_count,
    lowConfidenceCount: item.low_confidence_count,
    collaborativeScore: item.collaborative_score,
    totalScore: item.total_score,
    createdAt: item.created_at,
    updatedAt: item.updated_at
  }));
}

export async function updateReviewQueueItem(input: {
  reportId: string;
  action: ReviewActionRequest["action"];
  actor?: string;
  note?: string;
}): Promise<ReviewActionResult | null> {
  const report = await getExamReport(input.reportId);

  if (!report || !isReviewNeeded(report)) {
    return null;
  }

  const existingTask = await selectOne<ReviewTaskRow>("review_tasks", {
    report_id: `eq.${report.id}`
  });
  const beforeStatus = existingTask?.status ?? "OPEN";
  const afterStatus = nextReviewStatus(input.action);
  const actor = input.actor?.trim() || "local-reviewer";
  const note = input.note?.trim() || null;
  const actedAt = nowIso();
  const taskBody = {
    report_id: report.id,
    grading_job_id: report.gradingJobId,
    status: afterStatus,
    assignee: input.action === "ASSIGN" ? actor : existingTask?.assignee ?? actor,
    reviewer_note: note ?? existingTask?.reviewer_note ?? null,
    resolved_at: afterStatus === "RESOLVED" ? actedAt : existingTask?.resolved_at ?? null,
    rejected_at: afterStatus === "REJECTED" ? actedAt : existingTask?.rejected_at ?? null,
    updated_at: actedAt
  };

  if (existingTask) {
    await supabaseRest<ReviewTaskRow[]>("review_tasks", {
      method: "PATCH",
      query: {
        report_id: `eq.${report.id}`
      },
      prefer: "return=representation",
      body: taskBody
    });
  } else {
    await supabaseRest<ReviewTaskRow[]>("review_tasks", {
      method: "POST",
      prefer: "return=representation",
      body: taskBody
    });
  }

  const auditRows = await supabaseRest<AuditLogRow[]>("audit_logs", {
    method: "POST",
    prefer: "return=representation",
    body: {
      actor,
      action: `review.${input.action.toLowerCase()}`,
      target: `report:${report.id}`,
      before: {
        reviewStatus: beforeStatus
      },
      after: {
        reviewStatus: afterStatus,
        note
      }
    }
  });
  const audit = auditRows[0];

  if (!audit) {
    throw new StoreBackendError("SUPABASE_REVIEW_AUDIT_FAILED", "Unable to record review audit log.", 500);
  }

  return {
    item:
      afterStatus === "RESOLVED" || afterStatus === "REJECTED"
        ? null
        : {
            gradingJobId: report.gradingJobId,
            reportId: report.id,
            sessionId: report.sessionId,
            reviewStatus: afterStatus,
            assignee: taskBody.assignee,
            reviewerNote: taskBody.reviewer_note,
            auditCount: 1,
            reviewCount: report.reviewCount,
            lowConfidenceCount: report.lowConfidenceCount,
            collaborativeScore: report.collaborativeScore,
            totalScore: report.totalScore,
            createdAt: report.createdAt,
            updatedAt: actedAt
          },
    auditLog: {
      id: audit.id,
      reportId: report.id,
      gradingJobId: report.gradingJobId,
      actor: audit.actor,
      action: input.action,
      beforeStatus,
      afterStatus,
      note,
      createdAt: audit.created_at
    }
  };
}

export async function adjustReportQuestionScore(input: {
  reportId: string;
  questionId: string;
  score: ReviewScoreAdjustmentRequest["score"];
  actor?: string;
  reason: ReviewScoreAdjustmentRequest["reason"];
}): Promise<ReviewScoreAdjustmentResult | null> {
  const report = await getExamReport(input.reportId);

  if (!report || !isReviewNeeded(report)) {
    return null;
  }

  const question = report.questions.find((item) => item.questionId === input.questionId);

  if (!question || input.score < 0 || input.score > question.maxScore) {
    return null;
  }

  const existingTask = await selectOne<ReviewTaskRow>("review_tasks", {
    report_id: `eq.${report.id}`
  });
  const reviewStatus = existingTask?.status ?? "OPEN";
  const actor = input.actor?.trim() || "local-reviewer";
  const note = input.reason.trim();
  const beforeScore = question.collaborativeScore;
  const adjustedQuestions = report.questions.map((item) =>
    item.questionId === question.questionId
      ? {
          ...item,
          collaborativeScore: input.score,
          score: input.score,
          confidence: "high",
          requiresReview: false,
          evidence: `人工复核校准：${note}`
        }
      : item
  );
  const collaborativeScore = adjustedQuestions.reduce((sum, item) => sum + item.collaborativeScore, 0);
  const reviewCount = adjustedQuestions.filter((item) => item.requiresReview).length;

  await supabaseRest<GradingResultRow[]>("grading_results", {
    method: "PATCH",
    query: {
      job_id: `eq.${report.gradingJobId}`,
      question_id: `eq.${question.questionId}`
    },
    prefer: "return=representation",
    body: {
      score: input.score,
      confidence: 0.95,
      evidence: {
        confidence: "high",
        evidence: `人工复核校准：${note}`,
        requiresReview: false,
        manualAdjustment: {
          actor,
          reason: note,
          beforeScore,
          afterScore: input.score
        }
      }
    }
  });

  await supabaseRest<ExamReportRow[]>("exam_reports", {
    method: "PATCH",
    query: {
      id: `eq.${report.id}`
    },
    prefer: "return=representation",
    body: {
      collaborative_score: collaborativeScore,
      summary: {
        aiHelpCount: report.aiHelpCount,
        lowConfidenceCount: report.lowConfidenceCount,
        reviewCount,
        totalScore: report.totalScore
      }
    }
  });

  const auditRows = await supabaseRest<AuditLogRow[]>("audit_logs", {
    method: "POST",
    prefer: "return=representation",
    body: {
      actor,
      action: "review.adjust_score",
      target: `report:${report.id}:question:${question.questionId}`,
      before: {
        reviewStatus,
        score: beforeScore
      },
      after: {
        reviewStatus,
        score: input.score,
        questionId: question.questionId,
        note
      }
    }
  });
  const audit = auditRows[0];

  if (!audit) {
    throw new StoreBackendError("SUPABASE_SCORE_ADJUSTMENT_AUDIT_FAILED", "Unable to record score adjustment audit log.", 500);
  }

  const adjustedReport = await getExamReport(report.id);

  if (!adjustedReport) {
    return null;
  }

  return {
    report: adjustedReport,
    item:
      isReviewNeeded(adjustedReport)
        ? {
            gradingJobId: adjustedReport.gradingJobId,
            reportId: adjustedReport.id,
            sessionId: adjustedReport.sessionId,
            reviewStatus,
            assignee: existingTask?.assignee ?? actor,
            reviewerNote: existingTask?.reviewer_note ?? note,
            auditCount: 1,
            reviewCount: adjustedReport.reviewCount,
            lowConfidenceCount: adjustedReport.lowConfidenceCount,
            collaborativeScore: adjustedReport.collaborativeScore,
            totalScore: adjustedReport.totalScore,
            createdAt: adjustedReport.createdAt,
            updatedAt: audit.created_at
          }
        : null,
    auditLog: {
      id: audit.id,
      reportId: adjustedReport.id,
      gradingJobId: adjustedReport.gradingJobId,
      actor: audit.actor,
      action: "ADJUST_SCORE",
      beforeStatus: reviewStatus,
      afterStatus: reviewStatus,
      questionId: question.questionId,
      beforeScore,
      afterScore: input.score,
      note,
      createdAt: audit.created_at
    }
  };
}
