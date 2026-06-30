function answerToText(answer) {
  if (!answer) {
    return "";
  }

  if (Array.isArray(answer.value)) {
    return answer.value.join(",");
  }

  return String(answer.value || "");
}

function latestAnswerText(versions) {
  if (!Array.isArray(versions) || versions.length === 0) {
    return "";
  }

  return answerToText(versions[versions.length - 1].answer);
}

function toAnswerPayload(question, value) {
  if (question.type === "single_choice") {
    return {
      type: "single_choice",
      value
    };
  }

  return {
    type: question.type,
    value
  };
}

function buildAnswerGrid(questions, answers, currentIndex) {
  return questions.map((question, index) => ({
    id: question.id,
    orderNo: question.orderNo,
    active: index === currentIndex,
    answered: Boolean((answers[question.id] || "").trim())
  }));
}

module.exports = {
  answerToText,
  latestAnswerText,
  toAnswerPayload,
  buildAnswerGrid
};
