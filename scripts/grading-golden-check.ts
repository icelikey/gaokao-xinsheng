import { gradeAnswer, gradePaper, normalizeMathText } from "@gaokao-xinsheng/grader";
import { mvpPaper, type AnswerPayload } from "@gaokao-xinsheng/contracts";

const byId = new Map(mvpPaper.questions.map((question) => [question.id, question]));

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const q1 = byId.get("q_2010_sd_math_01");
const q17 = byId.get("q_2010_sd_math_17");
const q19 = byId.get("q_2010_sd_math_19");

assert(q1 && q17 && q19, "golden questions must exist");

const q1Correct = gradeAnswer({
  question: q1,
  answer: { type: "single_choice", value: "B" }
});
assert(q1Correct.score === 5 && q1Correct.confidence === "high", "single choice correct answer should score full marks");

const q1Wrong = gradeAnswer({
  question: q1,
  answer: { type: "single_choice", value: "C" }
});
assert(q1Wrong.score === 0 && !q1Wrong.requiresReview, "single choice wrong answer should be deterministic zero");

const q17Equivalent = gradeAnswer({
  question: q17,
  answer: { type: "fill_blank", value: "3*x²" }
});
assert(q17Equivalent.score === 5 && q17Equivalent.confidence === "high", "fill blank equivalent expression should score full marks");

const q19Partial = gradeAnswer({
  question: q19,
  answer: { type: "free_response", value: "令x^2-4x+3=0，可得零点x=1和x=3。" }
});
assert(q19Partial.score > 0, "free response with reference conclusion should earn rubric points");
assert(q19Partial.requiresReview, "free response initial score should require review");

const paperResult = gradePaper({
  paper: mvpPaper,
  answers: {
    [q1.id]: { type: "single_choice", value: "B" } satisfies AnswerPayload,
    [q17.id]: { type: "fill_blank", value: "3*x^2" } satisfies AnswerPayload,
    [q19.id]: { type: "free_response", value: "零点x=1和x=3，步骤略。" } satisfies AnswerPayload
  }
});

assert(paperResult.results.length === 30, "paper grading should return 30 question results");
assert(paperResult.score >= 10, "paper grading should accumulate deterministic and rubric scores");
assert(paperResult.reviewCount >= 1, "paper grading should flag free response review needs");

console.log(
  JSON.stringify(
    {
      ok: true,
      paperId: mvpPaper.id,
      checkedQuestions: paperResult.results.length,
      score: paperResult.score,
      reviewCount: paperResult.reviewCount,
      normalizationSample: normalizeMathText("3*x²")
    },
    null,
    2
  )
);
