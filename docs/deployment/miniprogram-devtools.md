# WeChat Miniprogram DevTools Plan

## Purpose

`apps/miniprogram` is the real experience entry for "Gaokao Xinsheng". It must call the service-side API hosted by Vercel and must not hold model keys, Supabase service role keys or WeChat AppSecret.

## Local Preview Mode

Use this mode only for flow and visual confirmation.

1. Start the Web/API preview:

```powershell
pnpm dev
```

2. Open WeChat DevTools.
3. Import `apps/miniprogram` as the project root.
4. Keep `project.config.json` with:
   - `appid: touristappid`
   - `setting.urlCheck: false`
5. Keep `apps/miniprogram/env.js` pointed at:

```js
apiBaseUrl: "http://127.0.0.1:3000"
shareWebBaseUrl: "http://127.0.0.1:3000"
```

This mode is not suitable for real-device acceptance because the API is local HTTP.

## Staging Preview Mode

Use this mode after the GitHub repository is connected to Vercel.

1. Replace `appid` with the project appid.
2. Change `setting.urlCheck` to `true`.
3. Change `apps/miniprogram/env.js` to the Vercel Preview or staging domain:

```js
apiBaseUrl: "https://<vercel-preview-or-staging-domain>"
shareWebBaseUrl: "https://<vercel-preview-or-staging-domain>"
```

4. Configure the same HTTPS domain in the WeChat platform request domain settings.
5. Upload as an experience version and test on a real device.

## Security Boundary

- Do not add `SUPABASE_SERVICE_ROLE_KEY`, model API keys or WeChat AppSecret to `apps/miniprogram`.
- Do not call Supabase directly from the miniprogram.
- Do not call model APIs directly from the miniprogram.
- Do not use `/api/catalog/*` from the miniprogram because catalog endpoints are admin-preview endpoints.
- Use `/api/v1/papers/:paperId` for public paper data; it strips `answer` and `rubric`.
- Submit must keep a stable `Idempotency-Key` per session.

## Official References Checked

Checked on 2026-06-29:

- WeChat miniprogram network reference: https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html
- WeChat DevTools project config reference: https://developers.weixin.qq.com/miniprogram/dev/devtools/projectconfig.html
- WeChat user privacy reference: https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/

These links are the authority for final review before upload. Re-check them before production submission.

## Manual Acceptance Checklist

- The home page can connect to the selected API domain.
- A new exam session can be created and started.
- The exam page loads 30 public questions without answers or rubrics.
- Answers can be saved and restored after closing DevTools.
- L1/L2 AI hints do not reveal final answers.
- Submit creates exactly one report for the session idempotency key.
- The report page shows independent score, AI collaboration score and review count.
- Share-card generation returns a public share token.
- The share page shows public fields only.
- No secret-like string appears in `apps/miniprogram`.
