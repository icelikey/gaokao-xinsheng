import {
  adjustReportQuestionScore,
  createShareCard,
  createExamSession,
  getExamReport,
  getShareCardByToken,
  isStoreBackendError,
  listReviewQueue,
  requestAiHelp,
  saveAnswer,
  startExamSession,
  submitExamSession,
  updateReviewQueueItem
} from "../apps/web/src/lib/exam-store-backend";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const previousBackend = process.env.EXAM_STORE_BACKEND;
const previousSupabaseUrl = process.env.SUPABASE_URL;
const previousServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const previousAdapterEnabled = process.env.SUPABASE_STORE_ADAPTER_ENABLED;

async function main() {
  process.env.EXAM_STORE_BACKEND = "memory";
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_STORE_ADAPTER_ENABLED;

  const memorySession = await createExamSession({
    paperId: "paper_2010_sd_math_sci_mvp",
    mode: "FULL_PAPER",
    settings: {
      timer_mode: "RELAXED",
      paper_style: true,
      exam_audio: false,
      ai_tutor_enabled: true
    }
  });

  assert(memorySession, "Memory backend should create an exam session.");
  assert(memorySession.id.startsWith("exam_"), "Memory backend should return local preview IDs.");

  const startedSession = await startExamSession(memorySession.id);
  assert(startedSession?.state === "IN_PROGRESS", "Memory backend should start an exam session.");

  const q1 = "q_2010_sd_math_01";
  const beforeAiAnswer = await saveAnswer({
    sessionId: memorySession.id,
    questionId: q1,
    answer: {
      type: "single_choice",
      value: "C"
    },
    clientVersion: 1
  });
  assert(beforeAiAnswer?.answerVersion.id, "Memory backend should save a pre-AI answer.");

  const aiHelp = await requestAiHelp({
    sessionId: memorySession.id,
    questionId: q1,
    level: 1
  });
  assert(aiHelp?.preAiAnswerVersionId === beforeAiAnswer.answerVersion.id, "AI help must retain the pre-AI answer version.");

  await saveAnswer({
    sessionId: memorySession.id,
    questionId: q1,
    answer: {
      type: "single_choice",
      value: "B"
    },
    clientVersion: 2
  });
  await saveAnswer({
    sessionId: memorySession.id,
    questionId: "q_2010_sd_math_19",
    answer: {
      type: "free_response",
      value: "写出关键步骤但保留人工复核。"
    },
    clientVersion: 3
  });

  const report = await submitExamSession({
    sessionId: memorySession.id,
    idempotencyKey: "memory-dual-score-check"
  });
  assert(report, "Memory backend should create a grading report.");
  assert(report.independentScore < report.collaborativeScore, "Independent score must use the pre-AI snapshot, not the final answer.");
  assert(report.questions[0]?.independentScore === 0, "Question independent score should reflect the wrong pre-AI answer.");
  assert(report.questions[0]?.collaborativeScore === 5, "Question collaborative score should reflect the corrected final answer.");

  const reviewQueueBefore = await listReviewQueue();
  const currentReviewItem = reviewQueueBefore.find((item) => item.reportId === report.id);
  assert(currentReviewItem, "Review queue should include the low-confidence report.");
  assert(currentReviewItem.reviewStatus === "OPEN", "New review queue items should start as OPEN.");

  const assignedReview = await updateReviewQueueItem({
    reportId: report.id,
    action: "ASSIGN",
    actor: "contract-reviewer",
    note: "claim report for local contract check"
  });
  assert(assignedReview?.item?.reviewStatus === "ASSIGNED", "Review action should assign the report.");
  assert(assignedReview.auditLog.beforeStatus === "OPEN", "Review audit should record the previous status.");
  assert(assignedReview.auditLog.afterStatus === "ASSIGNED", "Review audit should record the assigned status.");
  assert(assignedReview.auditLog.actor === "contract-reviewer", "Review audit should record the actor.");

  const reviewQueueAfterAssign = await listReviewQueue();
  assert(
    reviewQueueAfterAssign.find((item) => item.reportId === report.id)?.reviewStatus === "ASSIGNED",
    "Assigned review item should remain in the active queue."
  );

  const reviewQuestion = report.questions.find((question) => question.requiresReview);
  assert(reviewQuestion, "Report should include a question that can be manually adjusted.");
  const adjustedScore = reviewQuestion.maxScore;
  const adjustedReview = await adjustReportQuestionScore({
    reportId: report.id,
    questionId: reviewQuestion.questionId,
    score: adjustedScore,
    actor: "contract-reviewer",
    reason: "manual score adjustment from local contract check"
  });
  assert(adjustedReview?.auditLog.action === "ADJUST_SCORE", "Score adjustment should write an adjustment audit action.");
  assert(adjustedReview.auditLog.beforeScore === reviewQuestion.collaborativeScore, "Score adjustment audit should record the previous score.");
  assert(adjustedReview.auditLog.afterScore === adjustedScore, "Score adjustment audit should record the adjusted score.");
  assert(adjustedReview.auditLog.questionId === reviewQuestion.questionId, "Score adjustment audit should record the question id.");
  assert(adjustedReview.report.collaborativeScore >= report.collaborativeScore, "Score adjustment should update report collaborative score.");
  const adjustedReport = await getExamReport(report.id);
  const adjustedQuestion = adjustedReport?.questions.find((question) => question.questionId === reviewQuestion.questionId);
  assert(adjustedQuestion?.score === adjustedScore, "Adjusted report should expose the calibrated question score.");
  assert(adjustedQuestion?.requiresReview === false, "Adjusted report question should leave per-question review state.");
  assert(adjustedReport, "Adjusted report should remain readable after score adjustment.");

  const resolvedReview = await updateReviewQueueItem({
    reportId: report.id,
    action: "RESOLVE",
    actor: "contract-reviewer",
    note: "resolved after local contract check"
  });
  assert(resolvedReview?.item === null, "Resolved review item should leave the active queue.");
  assert(resolvedReview?.auditLog.beforeStatus === "ASSIGNED", "Resolve audit should record the assigned prior status.");
  assert(resolvedReview?.auditLog.afterStatus === "RESOLVED", "Resolve audit should record the terminal status.");
  const reviewQueueAfterResolve = await listReviewQueue();
  assert(
    !reviewQueueAfterResolve.some((item) => item.reportId === report.id),
    "Resolved report should not remain in the active review queue."
  );

  const shareCard = await createShareCard({
    reportId: adjustedReport.id,
    idempotencyKey: "memory-share-poster-check"
  });
  assert(shareCard, "Memory backend should create a share card.");
  assert(shareCard.objectUrl.startsWith("data:image/png;base64,"), "Share card should expose a local PNG data URL.");
  assert(shareCard.poster.mimeType === "image/png", "Share poster should be a PNG.");
  assert(shareCard.publicFields.paperTitle === null, "Share card should hide the paper title by default.");
  assert(shareCard.publicFields.region === null, "Share card should hide the region by default.");
  assert(shareCard.publicFields.independentScore === adjustedReport.independentScore, "Share card should show independent score by default.");
  assert(
    shareCard.publicFields.collaborativeScore === adjustedReport.collaborativeScore,
    "Share card should show collaborative score by default."
  );
  assert(
    shareCard.poster.width === 1080 && shareCard.poster.height === 1440,
    "Share poster should use the 1080x1440 poster format."
  );
  assert(shareCard.poster.byteSize > 0, "Share poster should contain bitmap bytes.");
  assert(/^[a-f0-9]{64}$/.test(shareCard.poster.sha256), "Share poster should record a SHA-256 digest.");
  const pngBytes = Buffer.from(shareCard.objectUrl.split(",")[1] ?? "", "base64");
  assert(
    pngBytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a",
    "Share poster data URL must contain a valid PNG signature."
  );
  const publicShare = await getShareCardByToken(shareCard.token);
  assert(publicShare?.id === shareCard.id, "Public share token should resolve the share card.");
  const publicShareJson = JSON.stringify(publicShare);
  assert(!publicShareJson.includes("correctAnswer"), "Public share card must not expose correct answers.");
  assert(!publicShareJson.includes("userAnswer"), "Public share card must not expose user answers.");

  const hiddenShareCard = await createShareCard({
    reportId: adjustedReport.id,
    idempotencyKey: "memory-hidden-share-check",
    visibility: {
      showIndependentScore: false,
      showCollaborativeScore: false,
      showPaperTitle: false,
      showRegion: false
    }
  });
  assert(hiddenShareCard, "Memory backend should create a hidden-field share card.");
  assert(hiddenShareCard.objectUrl.startsWith("data:image/png;base64,"), "Hidden-field share card should still expose a PNG data URL.");
  assert(hiddenShareCard.publicFields.independentScore === null, "Hidden share card must not expose independent score.");
  assert(hiddenShareCard.publicFields.collaborativeScore === null, "Hidden share card must not expose collaborative score.");
  assert(hiddenShareCard.publicFields.totalScore === null, "Hidden share card must not expose total score.");
  assert(hiddenShareCard.publicFields.paperTitle === null, "Hidden share card must not expose paper title.");
  assert(hiddenShareCard.publicFields.region === null, "Hidden share card must not expose region.");
  const hiddenPublicShare = await getShareCardByToken(hiddenShareCard.token);
  assert(hiddenPublicShare, "Public hidden token should resolve the share card.");
  assert(hiddenPublicShare.publicFields.independentScore === null, "Public hidden token must keep independent score hidden.");
  assert(hiddenPublicShare.publicFields.collaborativeScore === null, "Public hidden token must keep collaborative score hidden.");
  assert(hiddenPublicShare.publicFields.totalScore === null, "Public hidden token must keep total score hidden.");

  process.env.EXAM_STORE_BACKEND = "supabase";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "placeholder-service-role-key";
  delete process.env.SUPABASE_STORE_ADAPTER_ENABLED;

  let pendingAdapterCode = "";

  try {
    await createExamSession({
      paperId: "paper_2010_sd_math_sci_mvp",
      mode: "FULL_PAPER",
      settings: {
        timer_mode: "RELAXED",
        paper_style: true,
        exam_audio: false,
        ai_tutor_enabled: true
      }
    });
  } catch (error) {
    if (isStoreBackendError(error)) {
      pendingAdapterCode = error.code;
    } else {
      throw error;
    }
  }

  assert(
    pendingAdapterCode === "SUPABASE_STORE_ADAPTER_PENDING",
    "Supabase backend should fail closed until the hosted adapter is implemented."
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        memoryBackendCreatesSession: true,
        memoryBackendKeepsPreAiSnapshot: true,
        memoryBackendDualScoreDiff: report.collaborativeScore - report.independentScore,
        memoryReviewWorkflowAudited: true,
        memoryScoreAdjustmentAudited: true,
        memoryReviewQueueRemovesResolved: true,
        memorySharePosterPng: true,
        memorySharePosterBytesPositive: shareCard.poster.byteSize > 0,
        memoryShareVisibilityHidesScores: true,
        memoryShareVisibilityHidesPaperAndRegion: true,
        supabaseBackendFailsClosed: true,
        supabasePendingCode: pendingAdapterCode
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
  if (previousBackend === undefined) {
    delete process.env.EXAM_STORE_BACKEND;
  } else {
    process.env.EXAM_STORE_BACKEND = previousBackend;
  }

  if (previousSupabaseUrl === undefined) {
    delete process.env.SUPABASE_URL;
  } else {
    process.env.SUPABASE_URL = previousSupabaseUrl;
  }

  if (previousServiceKey === undefined) {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  } else {
    process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceKey;
  }

  if (previousAdapterEnabled === undefined) {
    delete process.env.SUPABASE_STORE_ADAPTER_ENABLED;
  } else {
    process.env.SUPABASE_STORE_ADAPTER_ENABLED = previousAdapterEnabled;
  }
  });
