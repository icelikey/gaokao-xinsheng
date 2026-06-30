import { buildTutorHint, detectAnswerLeak } from "@gaokao-xinsheng/ai-tutor";
import { mvpPaper } from "@gaokao-xinsheng/contracts";

type Failure = {
  questionId: string;
  level: number;
  answer: string;
  message: string;
};

const failures: Failure[] = [];

for (const question of mvpPaper.questions) {
  for (const level of [1, 2] as const) {
    const hint = buildTutorHint({ question, level });
    const leaked =
      hint.revealsFinalAnswer ||
      detectAnswerLeak({
        output: hint.message,
        canonicalAnswer: question.answer
      });

    if (leaked) {
      failures.push({
        questionId: question.id,
        level,
        answer: question.answer,
        message: hint.message
      });
    }
  }
}

if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      paperId: mvpPaper.id,
      questions: mvpPaper.questions.length,
      checkedHints: mvpPaper.questions.length * 2,
      leakedHints: 0
    },
    null,
    2
  )
);
