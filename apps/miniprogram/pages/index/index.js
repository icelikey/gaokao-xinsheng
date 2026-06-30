const api = require("../../utils/api");

Page({
  data: {
    loading: false,
    healthStatus: "正在连接本地预览服务...",
    matchStatus: "正在读取届次目录...",
    lastSessionId: "",
    lastReportId: "",
    years: [],
    yearLabels: ["2010届"],
    selectedYearIndex: 0,
    regions: [],
    regionLabels: ["山东"],
    selectedRegionIndex: 0,
    trackLabels: ["理科"],
    selectedTrackIndex: 0,
    subjectLabels: ["数学"],
    selectedSubjectIndex: 0,
    candidates: [],
    selectedCandidateIndex: 0,
    selectedPaperId: "",
    selectedCandidateTitle: "",
    selectedCandidateMeta: "",
    selectedCandidateConfidence: ""
  },

  onLoad() {
    this.setData({
      lastSessionId: wx.getStorageSync("lastSessionId") || "",
      lastReportId: wx.getStorageSync("lastReportId") || ""
    });
    this.checkHealth();
    this.loadCatalog();
  },

  async checkHealth() {
    try {
      const health = await api.health();
      this.setData({
        healthStatus: `${health.service} / ${health.status}`
      });
    } catch (error) {
      this.setData({
        healthStatus: `连接失败：${error.message}`
      });
    }
  },

  async loadCatalog() {
    try {
      const years = await api.getCatalogYears();
      const selectedYear = years[0] || { year: 2010, label: "2010届" };
      const regions = await api.getCatalogRegions(selectedYear.year);
      const selectedRegion = regions[0] || { region: "山东", tracks: ["理科"] };

      this.setData({
        years,
        yearLabels: years.length ? years.map((item) => `${item.label} · 距今${item.yearsAgo}年`) : ["2010届"],
        selectedYearIndex: 0,
        regions,
        regionLabels: regions.length ? regions.map((item) => item.region) : ["山东"],
        selectedRegionIndex: 0,
        trackLabels: selectedRegion.tracks && selectedRegion.tracks.length ? selectedRegion.tracks : ["理科"],
        selectedTrackIndex: 0,
        matchStatus: "请选择届次信息并匹配试卷。"
      });

      await this.matchPaper();
    } catch (error) {
      this.setData({
        matchStatus: `目录读取失败：${error.message}`
      });
    }
  },

  async reloadRegions(year) {
    const regions = await api.getCatalogRegions(year);
    const selectedRegion = regions[0] || { region: "山东", tracks: ["理科"] };

    this.setData({
      regions,
      regionLabels: regions.length ? regions.map((item) => item.region) : ["山东"],
      selectedRegionIndex: 0,
      trackLabels: selectedRegion.tracks && selectedRegion.tracks.length ? selectedRegion.tracks : ["理科"],
      selectedTrackIndex: 0,
      candidates: [],
      selectedCandidateIndex: 0,
      selectedPaperId: "",
      selectedCandidateTitle: "",
      selectedCandidateMeta: "",
      selectedCandidateConfidence: ""
    });
  },

  async onYearChange(event) {
    const selectedYearIndex = Number(event.detail.value);
    const selectedYear = this.data.years[selectedYearIndex] || { year: 2010 };

    this.setData({
      selectedYearIndex,
      matchStatus: "届次已更新，请重新匹配试卷。"
    });
    await this.reloadRegions(selectedYear.year);
  },

  onRegionChange(event) {
    const selectedRegionIndex = Number(event.detail.value);
    const selectedRegion = this.data.regions[selectedRegionIndex] || { tracks: ["理科"] };

    this.setData({
      selectedRegionIndex,
      trackLabels: selectedRegion.tracks && selectedRegion.tracks.length ? selectedRegion.tracks : ["理科"],
      selectedTrackIndex: 0,
      candidates: [],
      selectedCandidateIndex: 0,
      selectedPaperId: "",
      selectedCandidateTitle: "",
      selectedCandidateMeta: "",
      selectedCandidateConfidence: "",
      matchStatus: "地区已更新，请重新匹配试卷。"
    });
  },

  onTrackChange(event) {
    this.setData({
      selectedTrackIndex: Number(event.detail.value),
      candidates: [],
      selectedCandidateIndex: 0,
      selectedPaperId: "",
      selectedCandidateTitle: "",
      selectedCandidateMeta: "",
      selectedCandidateConfidence: "",
      matchStatus: "科类已更新，请重新匹配试卷。"
    });
  },

  onSubjectChange(event) {
    this.setData({
      selectedSubjectIndex: Number(event.detail.value),
      candidates: [],
      selectedCandidateIndex: 0,
      selectedPaperId: "",
      selectedCandidateTitle: "",
      selectedCandidateMeta: "",
      selectedCandidateConfidence: "",
      matchStatus: "科目已更新，请重新匹配试卷。"
    });
  },

  onCandidateChange(event) {
    const selectedCandidateIndex = Number(event.detail.value);
    const selectedCandidate = this.data.candidates[selectedCandidateIndex];

    this.setData({
      selectedCandidateIndex,
      selectedPaperId: selectedCandidate ? selectedCandidate.id : "",
      selectedCandidateTitle: selectedCandidate ? selectedCandidate.title : "",
      selectedCandidateMeta: selectedCandidate
        ? `${selectedCandidate.year}届 · ${selectedCandidate.region} · ${selectedCandidate.track} · ${selectedCandidate.questionCount}题`
        : "",
      selectedCandidateConfidence: selectedCandidate ? `匹配置信度 ${Math.round(selectedCandidate.confidence * 100)}%` : "",
      matchStatus: selectedCandidate ? "候选卷已确认，可以开考。" : "请先匹配试卷。"
    });
  },

  getMatchInput() {
    const selectedYear = this.data.years[this.data.selectedYearIndex] || { year: 2010 };
    const selectedRegion = this.data.regions[this.data.selectedRegionIndex] || { region: "山东" };

    return {
      year: selectedYear.year,
      region: selectedRegion.region,
      track: this.data.trackLabels[this.data.selectedTrackIndex] || "理科",
      subject: this.data.subjectLabels[this.data.selectedSubjectIndex] || "数学",
      mode: "QUICK_15"
    };
  },

  async matchPaper() {
    this.setData({ loading: true, matchStatus: "正在匹配候选试卷..." });

    try {
      const result = await api.matchPapers(this.getMatchInput());
      const candidates = result.candidates || [];
      const selectedCandidateIndex = Math.max(
        0,
        candidates.findIndex((candidate) => candidate.id === result.autoSelectedPaperId)
      );
      const selectedCandidate = candidates[selectedCandidateIndex];

      this.setData({
        candidates,
        selectedCandidateIndex,
        selectedPaperId: selectedCandidate ? selectedCandidate.id : "",
        selectedCandidateTitle: selectedCandidate ? selectedCandidate.title : "",
        selectedCandidateMeta: selectedCandidate
          ? `${selectedCandidate.year}届 · ${selectedCandidate.region} · ${selectedCandidate.track} · ${selectedCandidate.questionCount}题`
          : "",
        selectedCandidateConfidence: selectedCandidate ? `匹配置信度 ${Math.round(selectedCandidate.confidence * 100)}%` : "",
        matchStatus: selectedCandidate ? "已匹配到候选卷，请确认后开考。" : "暂未匹配到试卷。"
      });
    } catch (error) {
      this.setData({
        candidates: [],
        selectedCandidateIndex: 0,
        selectedPaperId: "",
        selectedCandidateTitle: "",
        selectedCandidateMeta: "",
        selectedCandidateConfidence: "",
        matchStatus: `匹配失败：${error.message}`
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  async startExam() {
    this.setData({ loading: true });

    try {
      if (!this.data.selectedPaperId) {
        await this.matchPaper();
      }

      if (!this.data.selectedPaperId) {
        throw new Error("请先匹配并确认试卷");
      }

      const session = await api.createExamSession({
        paper_id: this.data.selectedPaperId,
        mode: "QUICK_15",
        settings: {
          timer_mode: "RELAXED",
          paper_style: true,
          exam_audio: false,
          ai_tutor_enabled: true
        }
      });

      await api.startExamSession(session.id);
      wx.setStorageSync("lastSessionId", session.id);
      this.setData({ lastSessionId: session.id });
      wx.navigateTo({
        url: `/pages/exam/index?sessionId=${session.id}`
      });
    } catch (error) {
      wx.showToast({
        title: error.message,
        icon: "none"
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  resumeExam() {
    if (!this.data.lastSessionId) {
      wx.showToast({
        title: "还没有可恢复的考试",
        icon: "none"
      });
      return;
    }

    wx.navigateTo({
      url: `/pages/exam/index?sessionId=${this.data.lastSessionId}`
    });
  },

  openLastReport() {
    if (!this.data.lastReportId) {
      wx.showToast({
        title: "还没有成绩单",
        icon: "none"
      });
      return;
    }

    wx.navigateTo({
      url: `/pages/report/index?reportId=${this.data.lastReportId}`
    });
  }
});
