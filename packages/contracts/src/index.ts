import { z } from "zod";
export {
  getMvpPaper,
  getPublicMvpPaper,
  getMvpQuestionStats,
  mvpPaper,
  type MvpPaper,
  type PublicMvpPaper,
  type PublicMvpQuestion,
  type MvpQuestion,
  type MvpQuestionType,
  type MvpRubricItem
} from "./mvp-paper";
export {
  getCatalogRegions,
  getCatalogYears,
  getDefaultPaperMatchInput,
  matchPapers,
  paperMappingRules,
  type CatalogRegion,
  type CatalogYear,
  type PaperCandidate,
  type PaperMappingRule,
  type PaperMatchInput,
  type PaperMatchResult
} from "./catalog";

export const ExamModeSchema = z.enum(["QUICK_15", "FULL_PAPER"]);

export const ExamSessionStateSchema = z.enum([
  "CREATED",
  "READY",
  "IN_PROGRESS",
  "PAUSED",
  "SUBMITTED",
  "GRADING",
  "GRADED",
  "FAILED",
  "CANCELLED"
]);

export const AnswerPayloadSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("single_choice"),
    value: z.string().min(1)
  }),
  z.object({
    type: z.literal("multiple_choice"),
    value: z.array(z.string().min(1)).min(1)
  }),
  z.object({
    type: z.literal("fill_blank"),
    value: z.string()
  }),
  z.object({
    type: z.literal("free_response"),
    value: z.string()
  })
]);

export const CreateExamSessionSchema = z.object({
  paper_id: z.string().min(1),
  mode: ExamModeSchema,
  settings: z.object({
    timer_mode: z.enum(["STRICT", "RELAXED"]),
    paper_style: z.boolean(),
    exam_audio: z.boolean(),
    ai_tutor_enabled: z.boolean()
  })
});

export const SaveAnswerSchema = z.object({
  client_version: z.number().int().nonnegative(),
  base_server_version: z.number().int().nonnegative(),
  answer: AnswerPayloadSchema,
  client_saved_at: z.string().datetime()
});

export const AiHelpRequestSchema = z.object({
  question_id: z.string().min(1),
  level: z.number().int().min(1).max(4),
  user_message: z.string().max(1000).optional()
});

export const SubmitExamSchema = z.object({
  confirm_unanswered: z.boolean(),
  last_known_server_version: z.number().int().nonnegative()
});

export const ShareVisibilitySchema = z
  .object({
    showIndependentScore: z.boolean().optional(),
    showCollaborativeScore: z.boolean().optional(),
    showPaperTitle: z.boolean().optional(),
    showRegion: z.boolean().optional()
  })
  .strict();

export const CreateShareCardSchema = z.object({
  visibility: ShareVisibilitySchema.optional()
});

export const ReviewActionSchema = z
  .object({
    action: z.enum(["ASSIGN", "RESOLVE", "REJECT"]),
    actor: z.string().min(1).max(120).optional(),
    note: z.string().max(1000).optional()
  })
  .strict();

export const ReviewScoreAdjustmentSchema = z
  .object({
    questionId: z.string().min(1),
    score: z.number().min(0),
    actor: z.string().min(1).max(120).optional(),
    reason: z.string().min(1).max(1000)
  })
  .strict();

export const PaperImportRubricItemSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    score: z.number().positive()
  })
  .strict();

export const PaperImportQuestionSchema = z
  .object({
    id: z.string().min(1),
    orderNo: z.number().int().positive(),
    section: z.string().min(1),
    type: z.enum(["single_choice", "multiple_choice", "fill_blank", "free_response"]),
    stem: z.string().min(1),
    maxScore: z.number().positive(),
    answer: z.string().min(1),
    options: z.array(z.string().min(1)).optional(),
    rubric: z.array(PaperImportRubricItemSchema).optional()
  })
  .strict();

export const PaperImportPayloadSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    year: z.number().int().min(1977).max(2100),
    region: z.string().min(1),
    track: z.string().min(1),
    subject: z.string().min(1),
    paperType: z.literal("QUICK_15"),
    totalScore: z.number().positive(),
    durationMinutes: z.number().int().positive(),
    status: z.enum(["DRAFT", "CONTENT_REVIEW", "RUBRIC_REVIEW", "AI_CALIBRATION", "PREVIEW"]).optional(),
    questions: z.array(PaperImportQuestionSchema).min(30).max(50)
  })
  .strict();

export const PaperImportRequestSchema = z
  .object({
    dryRun: z.boolean().optional(),
    conflictPolicy: z.enum(["replace_preview"]).optional(),
    actor: z.string().min(1).max(120).optional(),
    paper: PaperImportPayloadSchema
  })
  .strict();

export const PaperMatchRequestSchema = z.object({
  year: z.number().int().min(1977).max(2100),
  region: z.string().min(1),
  track: z.string().min(1),
  subject: z.string().min(1),
  mode: ExamModeSchema
});

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional()
});

export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    request_id: z.string(),
    data: dataSchema.nullable(),
    error: ApiErrorSchema.nullable()
  });

export type ExamMode = z.infer<typeof ExamModeSchema>;
export type ExamSessionState = z.infer<typeof ExamSessionStateSchema>;
export type AnswerPayload = z.infer<typeof AnswerPayloadSchema>;
export type CreateExamSession = z.infer<typeof CreateExamSessionSchema>;
export type SaveAnswer = z.infer<typeof SaveAnswerSchema>;
export type AiHelpRequest = z.infer<typeof AiHelpRequestSchema>;
export type SubmitExam = z.infer<typeof SubmitExamSchema>;
export type ShareVisibility = z.infer<typeof ShareVisibilitySchema>;
export type CreateShareCard = z.infer<typeof CreateShareCardSchema>;
export type ReviewActionRequest = z.infer<typeof ReviewActionSchema>;
export type ReviewScoreAdjustmentRequest = z.infer<typeof ReviewScoreAdjustmentSchema>;
export type PaperImportRubricItem = z.infer<typeof PaperImportRubricItemSchema>;
export type PaperImportQuestion = z.infer<typeof PaperImportQuestionSchema>;
export type PaperImportPayload = z.infer<typeof PaperImportPayloadSchema>;
export type PaperImportRequest = z.infer<typeof PaperImportRequestSchema>;
export type PaperMatchRequest = z.infer<typeof PaperMatchRequestSchema>;
