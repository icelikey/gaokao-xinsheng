const api = require("../../utils/api");

Page({
  data: {
    token: "",
    shareCard: null,
    status: "正在读取公开分享..."
  },

  onLoad(options) {
    this.setData({ token: options.token || "" });
    this.loadShareCard();
  },

  async loadShareCard() {
    if (!this.data.token) {
      this.setData({ status: "缺少分享令牌。" });
      return;
    }

    try {
      const shareCard = await api.getShareCard(this.data.token);
      this.setData({
        shareCard,
        status: "公开分享已读取。"
      });
    } catch (error) {
      this.setData({ status: `读取失败：${error.message}` });
    }
  }
});
