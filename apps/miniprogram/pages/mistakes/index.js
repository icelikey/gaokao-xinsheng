const api = require("../../utils/api");

function answerText(answer) {
  if (!answer) {
    return "未作答";
  }

  if (Array.isArray(answer.value)) {
    return answer.value.join(",");
  }

  return String(answer.value || "未作答");
}

function isMistake(question) {
  return question.score < question.maxScore || question.requiresReview;
}

Page({
  data: {
    reportId: "",
    report: null,
    mistakes: [],
    status: "正在读取错题回看..."
  },

  onLoad(options) {
    this.setData({
      reportId: options.reportId || wx.getStorageSync("lastReportId") || ""
    });
    this.loadMistakes();
  },

  async loadMistakes() {
    if (!this.data.reportId) {
      this.setData({ status: "缺少成绩单 ID。" });
      return;
    }

    try {
      const report = await api.getReport(this.data.reportId);
      const mistakes = (report.questions || []).filter(isMistake).map((question) => ({
        ...question,
        userAnswerText: answerText(question.userAnswer),
        reviewText: question.requiresReview ? "需要复核" : "无需复核"
      }));

      this.setData({
        report,
        mistakes,
        status: "错题回看已生成。"
      });
    } catch (error) {
      this.setData({ status: `读取失败：${error.message}` });
    }
  }
});
