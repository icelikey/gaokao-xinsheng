import type { AnswerPayload, MvpQuestion } from "@gaokao-xinsheng/contracts";

export type TutorHintLevel = 1 | 2 | 3 | 4;

export type TutorHint = {
  level: TutorHintLevel;
  message: string;
  knowledgePoints: string[];
  suggestedNextAction: string;
  revealsFinalAnswer: boolean;
  safetyFlags: string[];
};

const questionTypeCopy = {
  single_choice: {
    knowledgePoints: ["审题", "选项排除"],
    level1: "先看题目问的对象，再判断每个选项是在描述条件、范围还是结论。",
    level2: "把已知条件转成一个更熟悉的数学对象，再用排除法检查选项是否满足题意。",
    level3: "先写出题目中的核心关系，再用它去筛掉明显不符合的选项。",
    level4: "按“读条件、转关系、验选项”的顺序完成；最后再把候选项代回原题核对。"
  },
  fill_blank: {
    knowledgePoints: ["表达式变形", "结果校验"],
    level1: "先确认空格需要的是数值、表达式还是几何对象，不要急着计算。",
    level2: "把题目条件写成等式或公式，再检查单位、定义域和符号方向。",
    level3: "先完成最直接的一步变形，再把结果代回题目条件做一次校验。",
    level4: "按“列式、化简、代回检查”的顺序完成，注意等价表达式也可能正确。"
  },
  free_response: {
    knowledgePoints: ["解题步骤", "得分点表达"],
    level1: "先写清题目要求证明、求值还是求范围，再列出可用条件。",
    level2: "把解答拆成关键结论和步骤依据，每一步都要能对应到题目条件。",
    level3: "先写第一条关键关系式，再说明它来自哪个定义、公式或已知条件。",
    level4: "用“条件转化、关键关系、计算整理、结论回扣”的顺序组织答案，保留每个得分点。"
  }
} as const;

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[，。；：、,.。;:\s]/g, "")
    .replace(/[{}()（）]/g, "");
}

function answerToText(answer: string | AnswerPayload) {
  if (typeof answer === "string") {
    return answer;
  }

  if (Array.isArray(answer.value)) {
    return answer.value.join(",");
  }

  return String(answer.value);
}

function containsStandaloneOption(text: string, answer: string) {
  if (!/^[A-D]$/i.test(answer)) {
    return false;
  }

  return new RegExp(`(^|[^A-Za-z])${answer}([^A-Za-z]|$)`, "i").test(text);
}

export function detectAnswerLeak(input: {
  output: string;
  canonicalAnswer: string | AnswerPayload;
}) {
  const answer = answerToText(input.canonicalAnswer).trim();

  if (!answer) {
    return false;
  }

  if (containsStandaloneOption(input.output, answer)) {
    return true;
  }

  const normalizedAnswer = normalize(answer);

  if (normalizedAnswer.length < 2) {
    return false;
  }

  return normalize(input.output).includes(normalizedAnswer);
}

export function buildTutorHint(input: {
  question: MvpQuestion;
  level: number;
  userAnswer?: AnswerPayload | null;
}): TutorHint {
  const safeLevel = Math.min(4, Math.max(1, Math.trunc(input.level))) as TutorHintLevel;
  const copy = questionTypeCopy[input.question.type];
  const message = copy[`level${safeLevel}` as const];
  const safetyFlags: string[] = [];
  const revealsFinalAnswer = detectAnswerLeak({
    output: message,
    canonicalAnswer: input.question.answer
  });

  if (revealsFinalAnswer) {
    safetyFlags.push("ANSWER_LEAK_DETECTED");
  }

  if (safeLevel <= 2 && input.userAnswer) {
    safetyFlags.push("PRE_AI_VERSION_REQUIRED");
  }

  return {
    level: safeLevel,
    message,
    knowledgePoints: [...copy.knowledgePoints],
    suggestedNextAction:
      safeLevel === 1
        ? "先复述题目条件和目标。"
        : safeLevel === 2
          ? "写出可用公式或关键关系。"
          : safeLevel === 3
            ? "完成第一步，不要直接跳到结论。"
            : "整理成可得分的步骤。",
    revealsFinalAnswer,
    safetyFlags
  };
}
