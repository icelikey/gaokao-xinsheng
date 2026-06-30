const { env } = require("./env");

App({
  globalData: {
    apiBaseUrl: env.apiBaseUrl,
    shareWebBaseUrl: env.shareWebBaseUrl
  }
});
