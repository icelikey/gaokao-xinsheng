import {
  type AnswerPayload,
  type ExamMode,
  type ExamSessionState,
  type MvpPaper,
  type MvpQuestion,
  type PaperImportPayload,
  type ReviewActionRequest,
  type ReviewScoreAdjustmentRequest,
  type ShareVisibility,
  getMvpPaper,
  mvpPaper
} from "@gaokao-xinsheng/contracts";
import { buildTutorHint } from "@gaokao-xinsheng/ai-tutor";
import { gradePaper } from "@gaokao-xinsheng/grader";
import {
  buildPaperImportBatch,
  type PaperImportBatchRecord,
  type PaperImportConflictPolicy
} from "./paper-import";
import { buildLocalSharePoster, type SharePosterMetadata } from "./share-poster";

export type AnswerVersionRecord = {
  id: string;
  questionId: string;
  answer: AnswerPayload;
  clientVersion: number;
  serverVersion: number;
  createdAt: string;
};

export type AiHelpRecord = {
  id: string;
  questionId: string;
  level: number;
  preAiVersionId: string | null;
  message: string;
  knowledgePoints: string[];
  suggestedNextAction: string;
  revealsFinalAnswer: boolean;
  safetyFlags: string[];
  createdAt: string;
};

export type ExamSessionRecord = {
  id: string;
  userId: string;
  paperId: string;
  mode: ExamMode;
  state: ExamSessionState;
  settings: {
    timer_mode: "STRICT" | "RELAXED";
    paper_style: boolean;
    exam_audio: boolean;
    ai_tutor_enabled: boolean;
  };
  serverVersion: number;
  startAt: string | null;
  deadlineAt: string | null;
  submittedAt: string | null;
  submittedVersionId: string | null;
  gradingJobId: string | null;
  reportId: string | null;
  answers: Record<string, AnswerVersionRecord[]>;
  aiHelpEvents: AiHelpRecord[];
  createdAt: string;
  updatedAt: string;
};

export type ReportQuestion = {
  questionId: string;
  orderNo: number;
  type: MvpQuestion["type"];
  stem: string;
  userAnswer: AnswerPayload | null;
  correctAnswer: string;
  independentScore: number;
  collaborativeScore: number;
  score: number;
  maxScore: number;
  confidence: string;
  requiresReview: boolean;
  evidence: string;
};

export type GradingJobRecord = {
  id: string;
  sessionId: string;
  state: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
  idempotencyKey: string;
  reportId: string | null;
  lowConfidenceCount: number;
  reviewCount: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type ExamReportRecord = {
  id: string;
  sessionId: string;
  gradingJobId: string;
  independentScore: number;
  collaborativeScore: number;
  totalScore: number;
  aiHelpCount: number;
  lowConfidenceCount: number;
  reviewCount: number;
  questions: ReportQuestion[];
  createdAt: string;
};

export type ShareCardRecord = {
  id: string;
  reportId: string;
  token: string;
  template: "mvp-score-card";
  objectUrl: string;
  poster: SharePosterMetadata;
  publicFields: {
    title: string;
    paperTitle: string | null;
    region: string | null;
    independentScore: number | null;
    collaborativeScore: number | null;
    totalScore: number | null;
    aiHelpCount: number;
    reviewCount: number;
    disclaimer: string;
    visibility: ShareVisibilitySettings;
  };
  createdAt: string;
};

export type ShareVisibilitySettings = {
  showIndependentScore: boolean;
  showCollaborativeScore: boolean;
  showPaperTitle: boolean;
  showRegion: boolean;
};

export type ReviewStatus = "OPEN" | "ASSIGNED" | "RESOLVED" | "REJECTED";

export type ReviewQueueItem = {
  gradingJobId: string;
  reportId: string;
  sessionId: string;
  reviewStatus: ReviewStatus;
  assignee: string | null;
  reviewerNote: string | null;
  auditCount: number;
  reviewCount: number;
  lowConfidenceCount: number;
  collaborativeScore: number;
  totalScore: number;
  createdAt: string;
  updatedAt: string;
};

export type ReviewTaskRecord = {
  reportId: string;
  gradingJobId: string;
  reviewStatus: ReviewStatus;
  assignee: string | null;
  reviewerNote: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  rejectedAt: string | null;
};

export type ReviewAuditLogRecord = {
  id: string;
  reportId: string;
  gradingJobId: string;
  actor: string;
  action: ReviewActionRequest["action"] | "ADJUST_SCORE";
  beforeStatus: ReviewStatus;
  afterStatus: ReviewStatus;
  questionId?: string;
  beforeScore?: number;
  afterScore?: number;
  note: string | null;
  createdAt: string;
};

export type ReviewActionResult = {
  item: ReviewQueueItem | null;
  auditLog: ReviewAuditLogRecord;
};

export type ReviewScoreAdjustmentResult = {
  report: ExamReportRecord;
  item: ReviewQueueItem | null;
  auditLog: ReviewAuditLogRecord;
};

type StoreShape = {
  sessions: Map<string, ExamSessionRecord>;
  reports: Map<string, ExamReportRecord>;
  gradingJobs: Map<string, GradingJobRecord>;
  shareCards: Map<string, ShareCardRecord>;
  paperImportBatches: Map<string, PaperImportBatchRecord>;
  importedPapers: Map<string, PaperImportPayload>;
  reviewTasks: Map<string, ReviewTaskRecord>;
  reviewAuditLogs: Map<string, ReviewAuditLogRecord>;
  submitKeys: Map<string, string>;
  shareKeys: Map<string, string>;
};

const store = getStore();

function getStore(): StoreShape {
  const globalStore = globalThis as typeof globalThis & {
    __gaokaoExamStore?: StoreShape;
  };

  if (!globalStore.__gaokaoExamStore) {
    globalStore.__gaokaoExamStore = {
      sessions: new Map(),
      reports: new Map(),
      gradingJobs: new Map(),
      shareCards: new Map(),
      paperImportBatches: new Map(),
      importedPapers: new Map(),
      reviewTasks: new Map(),
      reviewAuditLogs: new Map(),
      submitKeys: new Map(),
      shareKeys: new Map()
    };
  }

  return globalStore.__gaokaoExamStore;
}

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
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

function countReviewAudits(reportId: string) {
  return [...store.reviewAuditLogs.values()].filter((item) => item.reportId === reportId).length;
}

function mapReviewQueueItem(report: ExamReportRecord, task?: ReviewTaskRecord): ReviewQueueItem {
  return {
    gradingJobId: report.gradingJobId,
    reportId: report.id,
    sessionId: report.sessionId,
    reviewStatus: task?.reviewStatus ?? "OPEN",
    assignee: task?.assignee ?? null,
    reviewerNote: task?.reviewerNote ?? null,
    auditCount: countReviewAudits(report.id),
    reviewCount: report.reviewCount,
    lowConfidenceCount: report.lowConfidenceCount,
    collaborativeScore: report.collaborativeScore,
    totalScore: report.totalScore,
    createdAt: report.createdAt,
    updatedAt: task?.updatedAt ?? report.createdAt
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getLatestAnswer(session: ExamSessionRecord, questionId: string) {
  return session.answers[questionId]?.at(-1) ?? null;
}

function getIndependentAnswer(session: ExamSessionRecord, questionId: string) {
  const firstAiEvent = session.aiHelpEvents.find((event) => event.questionId === questionId && event.preAiVersionId);
  const preAiVersion = firstAiEvent
    ? session.answers[questionId]?.find((version) => version.id === firstAiEvent.preAiVersionId)
    : null;

  return preAiVersion ?? getLatestAnswer(session, questionId);
}

export function normalizeShareVisibility(visibility?: ShareVisibility): ShareVisibilitySettings {
  return {
    showIndependentScore: visibility?.showIndependentScore ?? true,
    showCollaborativeScore: visibility?.showCollaborativeScore ?? true,
    showPaperTitle: visibility?.showPaperTitle ?? false,
    showRegion: visibility?.showRegion ?? false
  };
}

export function buildSharePublicFields(input: {
  report: ExamReportRecord;
  paper: MvpPaper | null;
  visibility?: ShareVisibility;
}) {
  const visibility = normalizeShareVisibility(input.visibility);
  const exposesAnyScore = visibility.showIndependentScore || visibility.showCollaborativeScore;

  return {
    title: "我重新完成了一场高考数学",
    paperTitle: visibility.showPaperTitle ? input.paper?.title ?? null : null,
    region: visibility.showRegion ? input.paper?.region ?? null : null,
    independentScore: visibility.showIndependentScore ? input.report.independentScore : null,
    collaborativeScore: visibility.showCollaborativeScore ? input.report.collaborativeScore : null,
    totalScore: exposesAnyScore ? input.report.totalScore : null,
    aiHelpCount: input.report.aiHelpCount,
    reviewCount: input.report.reviewCount,
    disclaimer: "这是一次AI估分记录，不等同于官方高考成绩。",
    visibility
  };
}

export function createExamSession(input: {
  paperId: string;
  mode: ExamMode;
  settings: ExamSessionRecord["settings"];
}) {
  const paper = getMvpPaper(input.paperId);

  if (!paper) {
    return null;
  }

  const createdAt = nowIso();
  const session: ExamSessionRecord = {
    id: makeId("exam"),
    userId: "local-preview-user",
    paperId: paper.id,
    mode: input.mode,
    state: "CREATED",
    settings: input.settings,
    serverVersion: 0,
    startAt: null,
    deadlineAt: null,
    submittedAt: null,
    submittedVersionId: null,
    gradingJobId: null,
    reportId: null,
    answers: {},
    aiHelpEvents: [],
    createdAt,
    updatedAt: createdAt
  };

  store.sessions.set(session.id, session);
  return clone(session);
}

export function getExamSession(sessionId: string) {
  const session = store.sessions.get(sessionId);
  return session ? clone(session) : null;
}

export function startExamSession(sessionId: string) {
  const session = store.sessions.get(sessionId);

  if (!session) {
    return null;
  }

  if (session.state === "CREATED" || session.state === "READY") {
    const start = new Date();
    const paper = getMvpPaper(session.paperId) ?? mvpPaper;
    session.state = "IN_PROGRESS";
    session.startAt = start.toISOString();
    session.deadlineAt = new Date(start.getTime() + paper.durationMinutes * 60 * 1000).toISOString();
    session.updatedAt = nowIso();
  }

  return clone(session);
}

export function saveAnswer(input: {
  sessionId: string;
  questionId: string;
  answer: AnswerPayload;
  clientVersion: number;
}) {
  const session = store.sessions.get(input.sessionId);

  if (!session || session.state === "SUBMITTED" || session.state === "GRADING" || session.state === "GRADED") {
    return null;
  }

  session.serverVersion += 1;
  const version: AnswerVersionRecord = {
    id: makeId("av"),
    questionId: input.questionId,
    answer: input.answer,
    clientVersion: input.clientVersion,
    serverVersion: session.serverVersion,
    createdAt: nowIso()
  };

  session.answers[input.questionId] = [...(session.answers[input.questionId] ?? []), version];
  session.state = "IN_PROGRESS";
  session.updatedAt = version.createdAt;

  return clone({
    session,
    answerVersion: version
  });
}

export function requestAiHelp(input: {
  sessionId: string;
  questionId: string;
  level: number;
}) {
  const session = store.sessions.get(input.sessionId);
  const paper = session ? getMvpPaper(session.paperId) ?? null : null;
  const question = paper?.questions.find((item) => item.id === input.questionId);

  if (!session || !question) {
    return null;
  }

  let preAiVersion = getLatestAnswer(session, question.id);

  if (!preAiVersion) {
    const saved = saveAnswer({
      sessionId: session.id,
      questionId: question.id,
      answer: { type: question.type === "single_choice" ? "single_choice" : question.type, value: "" } as AnswerPayload,
      clientVersion: 0
    });
    preAiVersion = saved?.answerVersion ?? null;
  }

  const hint = buildTutorHint({
    question,
    level: input.level,
    userAnswer: preAiVersion?.answer ?? null
  });

  const event: AiHelpRecord = {
    id: makeId("aih"),
    questionId: question.id,
    level: hint.level,
    preAiVersionId: preAiVersion?.id ?? null,
    message: hint.revealsFinalAnswer ? "本级提示被安全规则拦截，请先从题意和条件开始。" : hint.message,
    knowledgePoints: hint.knowledgePoints,
    suggestedNextAction: hint.suggestedNextAction,
    revealsFinalAnswer: hint.revealsFinalAnswer,
    safetyFlags: hint.safetyFlags,
    createdAt: nowIso()
  };

  session.aiHelpEvents.push(event);
  session.updatedAt = event.createdAt;

  return clone({
    event,
    preAiAnswerVersionId: event.preAiVersionId
  });
}

export function submitExamSession(input: {
  sessionId: string;
  idempotencyKey: string;
}) {
  const existingReportId = store.submitKeys.get(`${input.sessionId}:${input.idempotencyKey}`);

  if (existingReportId) {
    return store.reports.get(existingReportId) ?? null;
  }

  const session = store.sessions.get(input.sessionId);
  const paper = session ? getMvpPaper(session.paperId) ?? null : null;

  if (!session || !paper) {
    return null;
  }

  const submittedAt = nowIso();
  const gradingJob: GradingJobRecord = {
    id: makeId("gradejob"),
    sessionId: session.id,
    state: "RUNNING",
    idempotencyKey: input.idempotencyKey,
    reportId: null,
    lowConfidenceCount: 0,
    reviewCount: 0,
    startedAt: submittedAt,
    completedAt: null,
    createdAt: submittedAt
  };
  const collaborativeAnswers = Object.fromEntries(
    paper.questions.map((question) => [question.id, getLatestAnswer(session, question.id)?.answer ?? null])
  );
  const independentAnswers = Object.fromEntries(
    paper.questions.map((question) => [question.id, getIndependentAnswer(session, question.id)?.answer ?? null])
  );
  const collaborativeGrading = gradePaper({
    paper,
    answers: collaborativeAnswers
  });
  const independentGrading = gradePaper({
    paper,
    answers: independentAnswers
  });
  const collaborativeResultMap = new Map(collaborativeGrading.results.map((result) => [result.questionId, result]));
  const independentResultMap = new Map(independentGrading.results.map((result) => [result.questionId, result]));
  const questions = paper.questions.map((question) => {
    const collaborative = collaborativeResultMap.get(question.id);
    const independent = independentResultMap.get(question.id);

    return {
      questionId: question.id,
      orderNo: question.orderNo,
      type: question.type,
      stem: question.stem,
      userAnswer: collaborativeAnswers[question.id] ?? null,
      correctAnswer: question.answer,
      independentScore: independent?.score ?? 0,
      collaborativeScore: collaborative?.score ?? 0,
      score: collaborative?.score ?? 0,
      maxScore: question.maxScore,
      confidence: collaborative?.confidence ?? "low",
      requiresReview: collaborative?.requiresReview ?? true,
      evidence: collaborative?.evidence ?? "评分结果缺失，需要复核。"
    };
  });

  gradingJob.state = "SUCCEEDED";
  gradingJob.lowConfidenceCount = collaborativeGrading.lowConfidenceCount;
  gradingJob.reviewCount = collaborativeGrading.reviewCount;
  gradingJob.completedAt = nowIso();

  const report: ExamReportRecord = {
    id: makeId("report"),
    sessionId: session.id,
    gradingJobId: gradingJob.id,
    independentScore: independentGrading.score,
    collaborativeScore: collaborativeGrading.score,
    totalScore: paper.totalScore,
    aiHelpCount: session.aiHelpEvents.length,
    lowConfidenceCount: collaborativeGrading.lowConfidenceCount,
    reviewCount: collaborativeGrading.reviewCount,
    questions,
    createdAt: submittedAt
  };
  gradingJob.reportId = report.id;

  session.state = "GRADED";
  session.submittedAt = submittedAt;
  session.submittedVersionId = Object.values(session.answers).flat().at(-1)?.id ?? null;
  session.gradingJobId = gradingJob.id;
  session.reportId = report.id;
  session.updatedAt = submittedAt;

  store.gradingJobs.set(gradingJob.id, gradingJob);
  store.reports.set(report.id, report);
  store.submitKeys.set(`${input.sessionId}:${input.idempotencyKey}`, report.id);

  return clone(report);
}

export function getExamReport(reportId: string) {
  const report = store.reports.get(reportId);
  return report ? clone(report) : null;
}

export function getGradingJob(jobId: string) {
  const job = store.gradingJobs.get(jobId);
  return job ? clone(job) : null;
}

export function createShareCard(input: {
  reportId: string;
  idempotencyKey: string;
  visibility?: ShareVisibility;
}) {
  const existingToken = store.shareKeys.get(`${input.reportId}:${input.idempotencyKey}`);

  if (existingToken) {
    return store.shareCards.get(existingToken) ?? null;
  }

  const report = store.reports.get(input.reportId);

  if (!report) {
    return null;
  }

  const token = makeId("sharetoken");
  const session = store.sessions.get(report.sessionId);
  const paper = session ? getMvpPaper(session.paperId) ?? null : null;
  const publicFields = buildSharePublicFields({
    report,
    paper,
    visibility: input.visibility
  });
  const poster = buildLocalSharePoster({
    reportId: report.id,
    token,
    publicFields
  });
  const shareCard: ShareCardRecord = {
    id: makeId("share"),
    reportId: report.id,
    token,
    template: "mvp-score-card",
    objectUrl: poster.objectUrl,
    poster: poster.poster,
    publicFields,
    createdAt: nowIso()
  };

  store.shareCards.set(shareCard.token, shareCard);
  store.shareKeys.set(`${input.reportId}:${input.idempotencyKey}`, shareCard.token);

  return clone(shareCard);
}

export function getShareCardByToken(token: string) {
  const shareCard = store.shareCards.get(token);
  return shareCard ? clone(shareCard) : null;
}

export function createPaperImport(input: {
  paper: PaperImportPayload;
  dryRun?: boolean;
  conflictPolicy?: PaperImportConflictPolicy;
  actor?: string;
}) {
  const batch = buildPaperImportBatch({
    id: makeId("paperimport"),
    paper: input.paper,
    dryRun: input.dryRun ?? true,
    conflictPolicy: input.conflictPolicy,
    actor: input.actor,
    createdAt: nowIso()
  });

  if (batch.status === "IMPORTED") {
    store.importedPapers.set(input.paper.id, clone(input.paper));
  }

  store.paperImportBatches.set(batch.id, batch);
  return clone(batch);
}

export function getImportedPaper(paperId: string) {
  const paper = store.importedPapers.get(paperId);
  return paper ? clone(paper) : null;
}

export function listReviewQueue() {
  const items = [...store.reports.values()]
    .filter(isReviewNeeded)
    .map((report) => mapReviewQueueItem(report, store.reviewTasks.get(report.id)))
    .filter((item) => item.reviewStatus !== "RESOLVED" && item.reviewStatus !== "REJECTED")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return clone(items);
}

export function updateReviewQueueItem(input: {
  reportId: string;
  action: ReviewActionRequest["action"];
  actor?: string;
  note?: string;
}) {
  const report = store.reports.get(input.reportId);

  if (!report || !isReviewNeeded(report)) {
    return null;
  }

  const existingTask = store.reviewTasks.get(report.id);
  const beforeStatus = existingTask?.reviewStatus ?? "OPEN";
  const afterStatus = nextReviewStatus(input.action);
  const actedAt = nowIso();
  const actor = input.actor?.trim() || "local-reviewer";
  const note = input.note?.trim() || null;
  const task: ReviewTaskRecord = {
    reportId: report.id,
    gradingJobId: report.gradingJobId,
    reviewStatus: afterStatus,
    assignee: input.action === "ASSIGN" ? actor : existingTask?.assignee ?? actor,
    reviewerNote: note ?? existingTask?.reviewerNote ?? null,
    createdAt: existingTask?.createdAt ?? actedAt,
    updatedAt: actedAt,
    resolvedAt: afterStatus === "RESOLVED" ? actedAt : existingTask?.resolvedAt ?? null,
    rejectedAt: afterStatus === "REJECTED" ? actedAt : existingTask?.rejectedAt ?? null
  };
  const auditLog: ReviewAuditLogRecord = {
    id: makeId("reviewaudit"),
    reportId: report.id,
    gradingJobId: report.gradingJobId,
    actor,
    action: input.action,
    beforeStatus,
    afterStatus,
    note,
    createdAt: actedAt
  };

  store.reviewTasks.set(report.id, task);
  store.reviewAuditLogs.set(auditLog.id, auditLog);

  return clone({
    item: afterStatus === "RESOLVED" || afterStatus === "REJECTED" ? null : mapReviewQueueItem(report, task),
    auditLog
  });
}

export function adjustReportQuestionScore(input: {
  reportId: string;
  questionId: string;
  score: number;
  actor?: string;
  reason: ReviewScoreAdjustmentRequest["reason"];
}): ReviewScoreAdjustmentResult | null {
  const report = store.reports.get(input.reportId);

  if (!report || !isReviewNeeded(report)) {
    return null;
  }

  const question = report.questions.find((item) => item.questionId === input.questionId);

  if (!question || input.score < 0 || input.score > question.maxScore) {
    return null;
  }

  const existingTask = store.reviewTasks.get(report.id);
  const reviewStatus = existingTask?.reviewStatus ?? "OPEN";
  const beforeScore = question.collaborativeScore;
  const actedAt = nowIso();
  const actor = input.actor?.trim() || "local-reviewer";
  const note = input.reason.trim();

  question.collaborativeScore = input.score;
  question.score = input.score;
  question.confidence = "high";
  question.requiresReview = false;
  question.evidence = `人工复核校准：${note}`;
  report.collaborativeScore = report.questions.reduce((sum, item) => sum + item.collaborativeScore, 0);
  report.reviewCount = report.questions.filter((item) => item.requiresReview).length;

  const auditLog: ReviewAuditLogRecord = {
    id: makeId("reviewaudit"),
    reportId: report.id,
    gradingJobId: report.gradingJobId,
    actor,
    action: "ADJUST_SCORE",
    beforeStatus: reviewStatus,
    afterStatus: reviewStatus,
    questionId: question.questionId,
    beforeScore,
    afterScore: input.score,
    note,
    createdAt: actedAt
  };

  store.reviewAuditLogs.set(auditLog.id, auditLog);

  return clone({
    report,
    item: isReviewNeeded(report) ? mapReviewQueueItem(report, existingTask) : null,
    auditLog
  });
}
