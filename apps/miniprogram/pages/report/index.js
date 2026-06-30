const api = require("../../utils/api");

const defaultShareVisibility = {
  showIndependentScore: true,
  showCollaborativeScore: true,
  showPaperTitle: false,
  showRegion: false
};

function shareVisibilityKey(visibility) {
  return Object.keys(defaultShareVisibility)
    .map((key) => `${key}:${visibility[key] ? 1 : 0}`)
    .join("-");
}

function answerText(answer) {
  if (!answer) {
    return "未作答";
  }

  if (Array.isArray(answer.value)) {
    return answer.value.join(",");
  }

  return String(answer.value || "未作答");
}

Page({
  data: {
    reportId: "",
    report: null,
    status: "正在读取成绩单...",
    shareToken: "",
    shareUrl: "",
    shareVisibility: defaultShareVisibility
  },

  onLoad(options) {
    this.setData({
      reportId: options.reportId || wx.getStorageSync("lastReportId") || ""
    });
    this.loadReport();
  },

  async loadReport() {
    if (!this.data.reportId) {
      this.setData({ status: "缺少成绩单 ID。" });
      return;
    }

    try {
      const report = await api.getReport(this.data.reportId);
      const questions = (report.questions || []).map((question) => ({
        ...question,
        userAnswerText: answerText(question.userAnswer)
      }));

      this.setData({
        report: {
          ...report,
          questions
        },
        status: "成绩单已生成。"
      });
    } catch (error) {
      this.setData({ status: `读取失败：${error.message}` });
    }
  },

  async createShareCard() {
    const reportId = this.data.reportId;
    const visibilityKey = shareVisibilityKey(this.data.shareVisibility);
    const storageKey = `shareKey:${reportId}:${visibilityKey}`;
    let idempotencyKey = wx.getStorageSync(storageKey);

    if (!idempotencyKey) {
      idempotencyKey = `share-${reportId}-${visibilityKey}`;
      wx.setStorageSync(storageKey, idempotencyKey);
    }

    try {
      const app = getApp();
      const shareCard = await api.createShareCard(reportId, idempotencyKey, this.data.shareVisibility);
      const shareUrl = `${app.globalData.shareWebBaseUrl}/share/${shareCard.token}`;

      this.setData({
        shareToken: shareCard.token,
        shareUrl
      });
    } catch (error) {
      wx.showToast({
        title: error.message,
        icon: "none"
      });
    }
  },

  onShareVisibilityChange(event) {
    const field = event.currentTarget.dataset.field;

    if (!field) {
      return;
    }

    this.setData({
      [`shareVisibility.${field}`]: !this.data.shareVisibility[field],
      shareToken: "",
      shareUrl: ""
    });
  },

  copyShareUrl() {
    if (!this.data.shareUrl) {
      wx.showToast({
        title: "请先生成分享卡",
        icon: "none"
      });
      return;
    }

    wx.setClipboardData({
      data: this.data.shareUrl
    });
  },

  openMistakes() {
    if (!this.data.reportId) {
      wx.showToast({
        title: "缺少成绩单",
        icon: "none"
      });
      return;
    }

    wx.navigateTo({
      url: `/pages/mistakes/index?reportId=${this.data.reportId}`
    });
  }
});
