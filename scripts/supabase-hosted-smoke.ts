import { getMvpPaper, type AnswerPayload, type MvpQuestion } from "@gaokao-xinsheng/contracts";

const paperId = "paper_2010_sd_math_sci_mvp";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function uniqueKey(prefix: string) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
  return `${prefix}_${stamp}_${crypto.randomUUID()}`;
}

function answerFor(question: MvpQuestion): AnswerPayload {
  if (question.type === "single_choice") {
    return {
      type: "single_choice",
      value: question.options?.[0] ?? "A"
    };
  }

  return {
    type: question.type,
    value: question.type === "fill_blank" ? "3x^2" : "已按题意写出关键步骤，等待 AI 估分复核。"
  };
}

function wrongChoiceAnswer(question: MvpQuestion): AnswerPayload {
  const fallbackOptions = ["A", "B", "C", "D"];
  const options = question.options?.length ? question.options : fallbackOptions;
  const wrongValue = options.find((option) => option !== question.answer) ?? "A";

  return {
    type: "single_choice",
    value: wrongValue
  };
}

function correctChoiceAnswer(question: MvpQuestion): AnswerPayload {
  return {
    type: "single_choice",
    value: question.answer
  };
}

function getSmokeConfig() {
  if (process.env.SUPABASE_HOSTED_SMOKE !== "1") {
    return {
      enabled: false,
      missing: []
    };
  }

  const missing: string[] = [];

  if (process.env.EXAM_STORE_BACKEND !== "supabase") {
    missing.push("EXAM_STORE_BACKEND=supabase");
  }

  if (process.env.SUPABASE_STORE_ADAPTER_ENABLED !== "true") {
    missing.push("SUPABASE_STORE_ADAPTER_ENABLED=true");
  }

  if (!process.env.SUPABASE_URL) {
    missing.push("SUPABASE_URL");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  return {
    enabled: true,
    missing
  };
}

async function main() {
  const config = getSmokeConfig();

  if (!config.enabled) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          skipped: true,
          reason: "Set SUPABASE_HOSTED_SMOKE=1 with dev Supabase credentials to run the hosted write smoke test."
        },
        null,
        2
      )
    );
    return;
  }

  if (config.missing.length > 0) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          skipped: false,
          missing: config.missing
        },
        null,
        2
      )
    );
    process.exitCode = 1;
    return;
  }

  const paper = getMvpPaper(paperId);
  assert(paper, `Missing MVP paper: ${paperId}`);
  const store = await import("../apps/web/src/lib/exam-store-backend");
  const importBatch = await store.createPaperImport({
    paper,
    dryRun: false,
    conflictPolicy: "replace_preview",
    actor: "hosted-smoke-importer"
  });

  assert(importBatch.status === "IMPORTED", "Hosted Supabase paper import must commit the MVP paper.");
  assert(importBatch.commitSummary.committed, "Hosted paper import must report committed=true.");
  assert(importBatch.commitSummary.questionRows === paper.questions.length, "Hosted paper import must commit all question rows.");
  assert(importBatch.commitSummary.answerKeyRows === paper.questions.length, "Hosted paper import must commit all answer keys.");

  const choiceQuestion = paper.questions.find((question) => question.type === "single_choice");
  const writtenQuestion =
    paper.questions.find((question) => question.type === "fill_blank") ??
    paper.questions.find((question) => question.type === "free_response");

  assert(choiceQuestion, "Hosted smoke requires at least one single-choice question.");
  assert(writtenQuestion, "Hosted smoke requires at least one fill-blank or free-response question.");

  const session = await store.createExamSession({
    paperId,
    mode: "QUICK_15",
    settings: {
      timer_mode: "RELAXED",
      paper_style: true,
      exam_audio: false,
      ai_tutor_enabled: true
    }
  });

  assert(session, "Unable to create hosted Supabase exam session.");

  const started = await store.startExamSession(session.id);
  assert(started?.state === "IN_PROGRESS", "Hosted Supabase session did not start.");

  const savedChoice = await store.saveAnswer({
    sessionId: session.id,
    questionId: choiceQuestion.id,
    answer: wrongChoiceAnswer(choiceQuestion),
    clientVersion: 1
  });
  assert(savedChoice?.answerVersion.id, "Hosted Supabase did not save the pre-AI choice answer.");

  const savedWritten = await store.saveAnswer({
    sessionId: session.id,
    questionId: writtenQuestion.id,
    answer: answerFor(writtenQuestion),
    clientVersion: 2
  });
  assert(savedWritten?.answerVersion.id, "Hosted Supabase did not save the written answer.");

  const aiHelp = await store.requestAiHelp({
    sessionId: session.id,
    questionId: choiceQuestion.id,
    level: 1
  });
  assert(aiHelp?.event.id, "Hosted Supabase did not persist the AI help event.");
  assert(aiHelp.preAiAnswerVersionId, "AI help event must retain a pre-AI answer version.");
  assert(aiHelp.preAiAnswerVersionId === savedChoice.answerVersion.id, "AI help must point to the original pre-AI answer.");

  const correctedChoice = await store.saveAnswer({
    sessionId: session.id,
    questionId: choiceQuestion.id,
    answer: correctChoiceAnswer(choiceQuestion),
    clientVersion: 3
  });
  assert(correctedChoice?.answerVersion.id, "Hosted Supabase did not save the post-AI corrected choice answer.");

  const report = await store.submitExamSession({
    sessionId: session.id,
    idempotencyKey: uniqueKey("submit")
  });
  assert(report?.id, "Hosted Supabase did not create an exam report.");
  assert(report.questions.length === paper.questions.length, "Report question count must match the MVP paper.");
  assert(report.independentScore < report.collaborativeScore, "Hosted report must separate pre-AI independent score from final collaborative score.");

  const gradingJob = await store.getGradingJob(report.gradingJobId);
  assert(gradingJob?.state === "SUCCEEDED", "Hosted Supabase grading job must finish as SUCCEEDED.");
  assert(gradingJob.reportId === report.id, "Grading job must reference the generated report.");

  const shareIdempotencyKey = uniqueKey("share");
  const shareCard = await store.createShareCard({
    reportId: report.id,
    idempotencyKey: shareIdempotencyKey,
    visibility: {
      showIndependentScore: true,
      showCollaborativeScore: true,
      showPaperTitle: false,
      showRegion: false
    }
  });
  assert(shareCard?.token, "Hosted Supabase did not create a share card.");
  assert(shareCard.publicFields.paperTitle === null, "Hosted share card should hide paper title by default.");
  assert(shareCard.publicFields.region === null, "Hosted share card should hide region by default.");
  assert(
    shareCard.objectUrl.includes("/storage/v1/object/public/share-cards/"),
    "Hosted share card must expose a public Storage poster URL."
  );
  assert(shareCard.poster.mimeType === "image/png", "Hosted share poster must be a PNG.");
  assert(
    shareCard.poster.width === 1080 && shareCard.poster.height === 1440,
    "Hosted share poster must use the 1080x1440 format."
  );

  const duplicateShareCard = await store.createShareCard({
    reportId: report.id,
    idempotencyKey: shareIdempotencyKey,
    visibility: {
      showIndependentScore: true,
      showCollaborativeScore: true,
      showPaperTitle: false,
      showRegion: false
    }
  });
  assert(duplicateShareCard?.id === shareCard.id, "Share-card idempotency did not return the original card.");

  const hiddenShareCard = await store.createShareCard({
    reportId: report.id,
    idempotencyKey: uniqueKey("share_hidden"),
    visibility: {
      showIndependentScore: false,
      showCollaborativeScore: false,
      showPaperTitle: false,
      showRegion: false
    }
  });
  assert(hiddenShareCard?.token, "Hosted Supabase did not create a hidden-field share card.");
  assert(hiddenShareCard.publicFields.independentScore === null, "Hosted hidden share must hide independent score.");
  assert(hiddenShareCard.publicFields.collaborativeScore === null, "Hosted hidden share must hide collaborative score.");
  assert(hiddenShareCard.publicFields.totalScore === null, "Hosted hidden share must hide total score.");

  const publicShare = await store.getShareCardByToken(shareCard.token);
  assert(publicShare?.id === shareCard.id, "Public share token lookup failed.");
  const publicShareJson = JSON.stringify(publicShare);
  assert(!publicShareJson.includes("correctAnswer"), "Public share payload must not expose correct answers.");
  assert(!publicShareJson.includes("userAnswer"), "Public share payload must not expose user answers.");

  const reviewQueueBeforeAction = await store.listReviewQueue();
  const activeReviewItem = reviewQueueBeforeAction.find((item) => item.reportId === report.id);
  assert(activeReviewItem, "Hosted Supabase review queue should include the fresh low-confidence report.");

  const assignedReview = await store.updateReviewQueueItem({
    reportId: report.id,
    action: "ASSIGN",
    actor: "hosted-smoke-reviewer",
    note: "claim from hosted smoke"
  });
  assert(assignedReview?.auditLog.afterStatus === "ASSIGNED", "Hosted review action should assign the report.");

  const reviewQuestion = report.questions.find((question) => question.requiresReview);
  assert(reviewQuestion, "Hosted smoke report must include a reviewable question.");
  const scoreAdjustment = await store.adjustReportQuestionScore({
    reportId: report.id,
    questionId: reviewQuestion.questionId,
    score: reviewQuestion.maxScore,
    actor: "hosted-smoke-reviewer",
    reason: "manual score adjustment from hosted smoke"
  });
  assert(scoreAdjustment?.auditLog.action === "ADJUST_SCORE", "Hosted score adjustment must write an audit action.");
  assert(scoreAdjustment.auditLog.afterScore === reviewQuestion.maxScore, "Hosted score adjustment must persist the adjusted score.");

  const resolvedReview = await store.updateReviewQueueItem({
    reportId: report.id,
    action: "RESOLVE",
    actor: "hosted-smoke-reviewer",
    note: "resolve from hosted smoke"
  });
  assert(resolvedReview?.auditLog.afterStatus === "RESOLVED", "Hosted review action should resolve the report.");

  const reviewQueue = await store.listReviewQueue();
  assert(
    !reviewQueue.some((item) => item.reportId === report.id),
    "Hosted resolved review item should leave the active queue."
  );
  const freshSession = await store.getExamSession(session.id);

  console.log(
    JSON.stringify(
      {
        ok: true,
        skipped: false,
        writesDevRows: true,
        paperId,
        paperImportBatchId: importBatch.id,
        paperImportStatus: importBatch.status,
        paperImportQuestionRows: importBatch.commitSummary.questionRows,
        sessionId: session.id,
        reportId: report.id,
        gradingJobId: gradingJob.id,
        shareCardId: shareCard.id,
        shareTokenPrefix: shareCard.token.slice(0, 12),
        sharePosterObjectUrl: shareCard.objectUrl,
        sharePosterBytes: shareCard.poster.byteSize,
        shareVisibilityHidesScores: true,
        shareVisibilityHidesPaperAndRegion: true,
        sessionState: freshSession?.state,
        answerVersionCount: Object.values(freshSession?.answers ?? {}).flat().length,
        aiHelpCount: freshSession?.aiHelpEvents.length ?? 0,
        reportQuestionCount: report.questions.length,
        reviewQueueCount: reviewQueue.length,
        reviewWorkflowAudited: true,
        scoreAdjustmentAudited: true,
        reviewQueueRemovesResolved: true,
        shareIdempotent: true,
        publicShareHasPrivateAnswers: false
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        skipped: false,
        message: error instanceof Error ? error.message : String(error)
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
