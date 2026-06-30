const { env } = require("../env");

function getApiBaseUrl() {
  const app = typeof getApp === "function" ? getApp() : null;
  return (app && app.globalData && app.globalData.apiBaseUrl) || env.apiBaseUrl;
}

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${getApiBaseUrl()}${path}`,
      method: options.method || "GET",
      data: options.data,
      header: {
        "content-type": "application/json",
        ...(options.header || {})
      },
      success(response) {
        const payload = response.data || {};

        if (response.statusCode >= 200 && response.statusCode < 300 && !payload.error) {
          resolve(payload.data);
          return;
        }

        reject(new Error((payload.error && payload.error.message) || `HTTP ${response.statusCode}`));
      },
      fail(error) {
        reject(error);
      }
    });
  });
}

function health() {
  return request("/api/health");
}

function getPublicPaper(paperId) {
  return request(`/api/v1/papers/${paperId}`);
}

function getCatalogYears() {
  return request("/api/v1/catalog/years");
}

function getCatalogRegions(year) {
  return request(`/api/v1/catalog/regions?year=${year}`);
}

function matchPapers(data) {
  return request("/api/v1/catalog/match", {
    method: "POST",
    data
  });
}

function createExamSession(data) {
  return request("/api/v1/exam-sessions", {
    method: "POST",
    data
  });
}

function startExamSession(sessionId) {
  return request(`/api/v1/exam-sessions/${sessionId}/start`, {
    method: "POST"
  });
}

function getExamSession(sessionId) {
  return request(`/api/v1/exam-sessions/${sessionId}`);
}

function saveAnswer(sessionId, questionId, data) {
  return request(`/api/v1/exam-sessions/${sessionId}/answers/${questionId}`, {
    method: "PUT",
    data
  });
}

function requestAiHelp(sessionId, data) {
  return request(`/api/v1/exam-sessions/${sessionId}/ai-help`, {
    method: "POST",
    data
  });
}

function submitExamSession(sessionId, idempotencyKey, data) {
  return request(`/api/v1/exam-sessions/${sessionId}/submit`, {
    method: "POST",
    header: {
      "Idempotency-Key": idempotencyKey
    },
    data
  });
}

function getReport(reportId) {
  return request(`/api/v1/reports/${reportId}`);
}

function createShareCard(reportId, idempotencyKey, visibility = {}) {
  return request(`/api/v1/reports/${reportId}/share-cards`, {
    method: "POST",
    header: {
      "Idempotency-Key": idempotencyKey
    },
    data: { visibility }
  });
}

function getShareCard(token) {
  return request(`/api/v1/share/${token}`);
}

module.exports = {
  health,
  getPublicPaper,
  getCatalogYears,
  getCatalogRegions,
  matchPapers,
  createExamSession,
  startExamSession,
  getExamSession,
  saveAnswer,
  requestAiHelp,
  submitExamSession,
  getReport,
  createShareCard,
  getShareCard
};
