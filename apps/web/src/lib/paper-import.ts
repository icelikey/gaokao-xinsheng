import { createHash } from "node:crypto";
import type { PaperImportPayload } from "@gaokao-xinsheng/contracts";

export type PaperImportIssue = {
  code: string;
  severity: "error" | "warning";
  message: string;
  questionId?: string;
};

export type PaperImportSummary = {
  questionCount: number;
  totalScore: number;
  maxScoreSum: number;
  answerKeyCount: number;
  rubricQuestionCount: number;
  byType: {
    single_choice: number;
    multiple_choice: number;
    fill_blank: number;
    free_response: number;
  };
};

export type PaperImportStatus = "VALIDATED" | "REJECTED" | "IMPORTED";
export type PaperImportConflictPolicy = "replace_preview";

export type PaperImportCommitSummary = {
  committed: boolean;
  conflictPolicy: PaperImportConflictPolicy;
  paperRows: number;
  sectionRows: number;
  questionRows: number;
  answerKeyRows: number;
  rubricRows: number;
};

export type PaperImportBatchRecord = {
  id: string;
  paperId: string;
  title: string;
  dryRun: boolean;
  conflictPolicy: PaperImportConflictPolicy;
  actor: string;
  status: PaperImportStatus;
  payloadHash: string;
  summary: PaperImportSummary;
  commitSummary: PaperImportCommitSummary;
  issues: PaperImportIssue[];
  auditAction: "paper_import.validated" | "paper_import.rejected" | "paper_import.imported";
  createdAt: string;
};

const questionTypes = ["single_choice", "multiple_choice", "fill_blank", "free_response"] as const;

export function hashPaperImportPayload(paper: PaperImportPayload) {
  return createHash("sha256").update(JSON.stringify(paper)).digest("hex");
}

export function validatePaperImport(paper: PaperImportPayload) {
  const issues: PaperImportIssue[] = [];
  const ids = new Set<string>();
  const orderNos = new Set<number>();
  const summary: PaperImportSummary = {
    questionCount: paper.questions.length,
    totalScore: paper.totalScore,
    maxScoreSum: 0,
    answerKeyCount: 0,
    rubricQuestionCount: 0,
    byType: {
      single_choice: 0,
      multiple_choice: 0,
      fill_blank: 0,
      free_response: 0
    }
  };

  for (const question of paper.questions) {
    summary.maxScoreSum += question.maxScore;
    summary.answerKeyCount += question.answer.trim() ? 1 : 0;
    summary.byType[question.type] += 1;

    if (ids.has(question.id)) {
      issues.push({
        code: "QUESTION_ID_DUPLICATE",
        severity: "error",
        questionId: question.id,
        message: `Duplicate question id: ${question.id}`
      });
    }
    ids.add(question.id);

    if (orderNos.has(question.orderNo)) {
      issues.push({
        code: "QUESTION_ORDER_DUPLICATE",
        severity: "error",
        questionId: question.id,
        message: `Duplicate question order: ${question.orderNo}`
      });
    }
    orderNos.add(question.orderNo);

    if ((question.type === "single_choice" || question.type === "multiple_choice") && (!question.options || question.options.length < 2)) {
      issues.push({
        code: "CHOICE_OPTIONS_MISSING",
        severity: "error",
        questionId: question.id,
        message: "Choice questions require at least two options."
      });
    }

    if (question.type === "free_response") {
      const rubricTotal = question.rubric?.reduce((total, item) => total + item.score, 0) ?? 0;

      if (!question.rubric || question.rubric.length === 0) {
        issues.push({
          code: "RUBRIC_MISSING",
          severity: "error",
          questionId: question.id,
          message: "Free-response questions require rubric items."
        });
      } else {
        summary.rubricQuestionCount += 1;
      }

      if (Math.abs(rubricTotal - question.maxScore) > 0.001) {
        issues.push({
          code: "RUBRIC_SCORE_MISMATCH",
          severity: "error",
          questionId: question.id,
          message: `Rubric score ${rubricTotal} does not match max score ${question.maxScore}.`
        });
      }
    }
  }

  if (summary.maxScoreSum !== paper.totalScore) {
    issues.push({
      code: "PAPER_TOTAL_SCORE_MISMATCH",
      severity: "error",
      message: `Question max-score sum ${summary.maxScoreSum} does not match paper total ${paper.totalScore}.`
    });
  }

  for (const type of questionTypes) {
    if (summary.byType[type] === 0) {
      issues.push({
        code: "QUESTION_TYPE_MISSING",
        severity: "warning",
        message: `No ${type} questions were included.`
      });
    }
  }

  return {
    summary,
    issues,
    hasErrors: issues.some((issue) => issue.severity === "error")
  };
}

export function summarizePaperImportSections(paper: PaperImportPayload) {
  const sectionMap = new Map<string, { title: string; orderNo: number; maxScore: number }>();

  for (const question of paper.questions) {
    const existing = sectionMap.get(question.section);

    if (existing) {
      existing.maxScore += question.maxScore;
      continue;
    }

    sectionMap.set(question.section, {
      title: question.section,
      orderNo: sectionMap.size + 1,
      maxScore: question.maxScore
    });
  }

  return [...sectionMap.values()];
}

export function buildPaperImportCommitSummary(input: {
  paper: PaperImportPayload;
  status: PaperImportStatus;
  dryRun: boolean;
  conflictPolicy: PaperImportConflictPolicy;
}): PaperImportCommitSummary {
  const shouldCommit = input.status === "IMPORTED" && !input.dryRun;
  const sections = summarizePaperImportSections(input.paper);
  const rubricRows = input.paper.questions.filter((question) => question.rubric?.length).length;

  return {
    committed: shouldCommit,
    conflictPolicy: input.conflictPolicy,
    paperRows: shouldCommit ? 1 : 0,
    sectionRows: shouldCommit ? sections.length : 0,
    questionRows: shouldCommit ? input.paper.questions.length : 0,
    answerKeyRows: shouldCommit ? input.paper.questions.length : 0,
    rubricRows: shouldCommit ? rubricRows : 0
  };
}

export function buildPaperImportBatch(input: {
  id: string;
  paper: PaperImportPayload;
  dryRun: boolean;
  conflictPolicy?: PaperImportConflictPolicy;
  actor?: string;
  createdAt: string;
}): PaperImportBatchRecord {
  const validation = validatePaperImport(input.paper);
  const status: PaperImportStatus = validation.hasErrors ? "REJECTED" : input.dryRun ? "VALIDATED" : "IMPORTED";
  const conflictPolicy = input.conflictPolicy ?? "replace_preview";

  return {
    id: input.id,
    paperId: input.paper.id,
    title: input.paper.title,
    dryRun: input.dryRun,
    conflictPolicy,
    actor: input.actor?.trim() || "local-importer",
    status,
    payloadHash: hashPaperImportPayload(input.paper),
    summary: validation.summary,
    commitSummary: buildPaperImportCommitSummary({
      paper: input.paper,
      status,
      dryRun: input.dryRun,
      conflictPolicy
    }),
    issues: validation.issues,
    auditAction:
      status === "REJECTED"
        ? "paper_import.rejected"
        : status === "IMPORTED"
          ? "paper_import.imported"
          : "paper_import.validated",
    createdAt: input.createdAt
  };
}
