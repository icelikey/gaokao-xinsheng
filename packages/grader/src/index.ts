import type { AnswerPayload, MvpPaper, MvpQuestion } from "@gaokao-xinsheng/contracts";

export type GradingConfidence = "high" | "medium" | "low";

export type RubricScore = {
  rubricId: string;
  name: string;
  score: number;
  maxScore: number;
  evidence: string;
};

export type GradingResult = {
  questionId: string;
  score: number;
  maxScore: number;
  confidence: GradingConfidence;
  requiresReview: boolean;
  evidence: string;
  rubricScores: RubricScore[];
};

export type PaperGradingResult = {
  score: number;
  maxScore: number;
  lowConfidenceCount: number;
  reviewCount: number;
  results: GradingResult[];
};

function answerToText(answer: AnswerPayload | null | undefined) {
  if (!answer) {
    return "";
  }

  if (Array.isArray(answer.value)) {
    return answer.value.join(",");
  }

  return String(answer.value);
}

export function normalizeMathText(value: string) {
  return value
    .toLowerCase()
    .replace(/[，。；：、]/g, ",")
    .replace(/[（）]/g, "")
    .replace(/\s+/g, "")
    .replace(/\*/g, "")
    .replace(/²/g, "^2")
    .replace(/＝/g, "=")
    .replace(/＜/g, "<")
    .replace(/＞/g, ">")
    .replace(/圆心/g, "")
    .replace(/半径/g, "")
    .replace(/最小值?/g, "最小")
    .replace(/最大值?/g, "最大");
}

function hasEquivalentFillAnswer(userAnswer: string, canonicalAnswer: string) {
  return normalizeMathText(userAnswer) === normalizeMathText(canonicalAnswer);
}

function textContainsCanonicalConclusion(userAnswer: string, canonicalAnswer: string) {
  const normalizedUser = normalizeMathText(userAnswer);
  const normalizedCanonical = normalizeMathText(canonicalAnswer);

  if (!normalizedCanonical) {
    return false;
  }

  if (normalizedUser.includes(normalizedCanonical)) {
    return true;
  }

  const canonicalParts = normalizedCanonical
    .split(/[,\uff0c]/)
    .map((part) => part.trim())
    .filter(Boolean);

  return canonicalParts.length > 0 && canonicalParts.every((part) => normalizedUser.includes(part));
}

function gradeObjective(question: MvpQuestion, answer: AnswerPayload | null): GradingResult {
  const userAnswer = answerToText(answer);
  const isCorrect = hasEquivalentFillAnswer(userAnswer, question.answer);

  return {
    questionId: question.id,
    score: isCorrect ? question.maxScore : 0,
    maxScore: question.maxScore,
    confidence: "high",
    requiresReview: false,
    evidence: isCorrect ? "确定性评分：答案与标准答案一致。" : answer ? "确定性评分：答案与标准答案不一致。" : "未作答。",
    rubricScores: []
  };
}

function gradeFillBlank(question: MvpQuestion, answer: AnswerPayload | null): GradingResult {
  const userAnswer = answerToText(answer);
  const isEquivalent = hasEquivalentFillAnswer(userAnswer, question.answer);

  return {
    questionId: question.id,
    score: isEquivalent ? question.maxScore : 0,
    maxScore: question.maxScore,
    confidence: isEquivalent ? "high" : "medium",
    requiresReview: false,
    evidence: isEquivalent
      ? "符号等价评分：作答与参考答案规范化后一致。"
      : answer
        ? "符号等价评分：规范化后未命中参考答案。"
        : "未作答。",
    rubricScores: []
  };
}

function gradeFreeResponse(question: MvpQuestion, answer: AnswerPayload | null): GradingResult {
  const userAnswer = answerToText(answer);

  if (!userAnswer.trim()) {
    return {
      questionId: question.id,
      score: 0,
      maxScore: question.maxScore,
      confidence: "high",
      requiresReview: false,
      evidence: "未作答。",
      rubricScores: []
    };
  }

  const conclusionHit = textContainsCanonicalConclusion(userAnswer, question.answer);
  const rubricScores =
    question.rubric?.map((rubricItem, index) => {
      const isConclusionRubric = index === 0;
      const earned = isConclusionRubric && conclusionHit ? rubricItem.score : !isConclusionRubric && userAnswer.length >= 8 ? rubricItem.score : 0;

      return {
        rubricId: rubricItem.id,
        name: rubricItem.name,
        score: earned,
        maxScore: rubricItem.score,
        evidence:
          earned > 0
            ? isConclusionRubric
              ? "作答中出现参考结论。"
              : "作答包含可检查的步骤表达。"
            : isConclusionRubric
              ? "未稳定命中参考结论。"
              : "步骤表达不足。"
      };
    }) ?? [];
  const score = rubricScores.reduce((sum, item) => sum + item.score, 0);
  const confidence: GradingConfidence = score === question.maxScore ? "medium" : score > 0 ? "low" : "low";

  return {
    questionId: question.id,
    score,
    maxScore: question.maxScore,
    confidence,
    requiresReview: true,
    evidence:
      score === question.maxScore
        ? "Rubric初评：关键结论和步骤表达均命中，建议抽检。"
        : score > 0
          ? "Rubric初评：部分得分点命中，需要复核。"
          : "Rubric初评：未稳定命中得分点，需要复核。",
    rubricScores
  };
}

export function gradeAnswer(input: {
  question: MvpQuestion;
  answer: AnswerPayload | null;
}): GradingResult {
  if (input.question.type === "single_choice") {
    return gradeObjective(input.question, input.answer);
  }

  if (input.question.type === "fill_blank") {
    return gradeFillBlank(input.question, input.answer);
  }

  return gradeFreeResponse(input.question, input.answer);
}

export function gradePaper(input: {
  paper: MvpPaper;
  answers: Record<string, AnswerPayload | null | undefined>;
}): PaperGradingResult {
  const results = input.paper.questions.map((question) =>
    gradeAnswer({
      question,
      answer: input.answers[question.id] ?? null
    })
  );

  return {
    score: results.reduce((sum, item) => sum + item.score, 0),
    maxScore: input.paper.totalScore,
    lowConfidenceCount: results.filter((item) => item.confidence === "low").length,
    reviewCount: results.filter((item) => item.requiresReview).length,
    results
  };
}
