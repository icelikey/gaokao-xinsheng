const api = require("../../utils/api");
const { buildAnswerGrid, latestAnswerText, toAnswerPayload } = require("../../utils/answers");

function typeLabel(type) {
  return {
    single_choice: "选择题",
    fill_blank: "填空题",
    free_response: "解答题"
  }[type] || "题目";
}

Page({
  data: {
    sessionId: "",
    paper: null,
    session: null,
    currentIndex: 0,
    currentQuestion: null,
    currentTypeLabel: "",
    currentQuestionIsChoice: false,
    currentAnswer: "",
    answers: {},
    answerGrid: [],
    hintLevels: [1, 2, 3, 4],
    clientVersion: 1,
    saveStatus: "正在恢复考试...",
    aiHint: "还没有请求 AI 提示。",
    submitting: false
  },

  onLoad(options) {
    this.setData({
      sessionId: options.sessionId || wx.getStorageSync("lastSessionId") || ""
    });
    this.restore();
  },

  async restore() {
    if (!this.data.sessionId) {
      this.setData({ saveStatus: "缺少考试会话，请回到首页重新开始。" });
      return;
    }

    try {
      const session = await api.getExamSession(this.data.sessionId);
      const paper = await api.getPublicPaper(session.paperId);
      const answers = {};

      Object.keys(session.answers || {}).forEach((questionId) => {
        answers[questionId] = latestAnswerText(session.answers[questionId]);
      });

      this.setData({
        paper,
        session,
        answers,
        saveStatus: "恢复成功，可以继续作答。"
      });
      this.syncCurrent(0, answers, paper);
    } catch (error) {
      this.setData({ saveStatus: `恢复失败：${error.message}` });
    }
  },

  syncCurrent(index, answers = this.data.answers, paper = this.data.paper) {
    if (!paper || !paper.questions.length) {
      return;
    }

    const safeIndex = Math.max(0, Math.min(index, paper.questions.length - 1));
    const currentQuestion = paper.questions[safeIndex];

    this.setData({
      currentIndex: safeIndex,
      currentQuestion,
      currentTypeLabel: typeLabel(currentQuestion.type),
      currentQuestionIsChoice: currentQuestion.type === "single_choice",
      currentAnswer: answers[currentQuestion.id] || "",
      answerGrid: buildAnswerGrid(paper.questions, answers, safeIndex)
    });
  },

  jumpToQuestion(event) {
    this.syncCurrent(Number(event.currentTarget.dataset.index));
  },

  updateChoice(event) {
    const value = event.currentTarget.dataset.value;
    const question = this.data.currentQuestion;
    const answers = {
      ...this.data.answers,
      [question.id]: value
    };

    this.setData({
      answers,
      currentAnswer: value,
      answerGrid: buildAnswerGrid(this.data.paper.questions, answers, this.data.currentIndex)
    });
    this.saveCurrentAnswer();
  },

  updateText(event) {
    const question = this.data.currentQuestion;
    const value = event.detail.value;
    const answers = {
      ...this.data.answers,
      [question.id]: value
    };

    this.setData({
      answers,
      currentAnswer: value,
      answerGrid: buildAnswerGrid(this.data.paper.questions, answers, this.data.currentIndex)
    });
  },

  async saveCurrentAnswer() {
    const question = this.data.currentQuestion;

    if (!question) {
      return false;
    }

    try {
      const saved = await api.saveAnswer(this.data.sessionId, question.id, {
        client_version: this.data.clientVersion,
        base_server_version: (this.data.session && this.data.session.serverVersion) || 0,
        answer: toAnswerPayload(question, this.data.currentAnswer),
        client_saved_at: new Date().toISOString()
      });

      this.setData({
        clientVersion: this.data.clientVersion + 1,
        session: saved.session,
        saveStatus: `第 ${question.orderNo} 题已保存`
      });
      return true;
    } catch (error) {
      this.setData({ saveStatus: `保存失败：${error.message}` });
      return false;
    }
  },

  async requestHint(event) {
    const question = this.data.currentQuestion;
    const level = Number(event.currentTarget.dataset.level);

    await this.saveCurrentAnswer();

    try {
      const hint = await api.requestAiHelp(this.data.sessionId, {
        question_id: question.id,
        level
      });

      this.setData({
        aiHint: `L${hint.event.level}: ${hint.event.message}`
      });
    } catch (error) {
      this.setData({ aiHint: `AI 提示失败：${error.message}` });
    }
  },

  previousQuestion() {
    this.syncCurrent(this.data.currentIndex - 1);
  },

  nextQuestion() {
    this.syncCurrent(this.data.currentIndex + 1);
  },

  async submitExam() {
    const sessionId = this.data.sessionId;
    const storageKey = `submitKey:${sessionId}`;
    let idempotencyKey = wx.getStorageSync(storageKey);

    if (!idempotencyKey) {
      idempotencyKey = `submit-${sessionId}`;
      wx.setStorageSync(storageKey, idempotencyKey);
    }

    this.setData({ submitting: true });
    await this.saveCurrentAnswer();

    try {
      const report = await api.submitExamSession(sessionId, idempotencyKey, {
        confirm_unanswered: true,
        last_known_server_version: (this.data.session && this.data.session.serverVersion) || 0
      });

      wx.setStorageSync("lastReportId", report.id);
      wx.redirectTo({
        url: `/pages/report/index?reportId=${report.id}`
      });
    } catch (error) {
      this.setData({
        submitting: false,
        saveStatus: `交卷失败：${error.message}`
      });
    }
  }
});
