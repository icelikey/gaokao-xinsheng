# 高考新生

云端优先的高考重考 + AI辅导 + AI估分 MVP。

## 当前目标

先完成可持续预览和验收的 M1-M7 本地闭环：

- GitHub monorepo 作为代码真源。
- Vercel 承载 Web 流程预览、运营后台、分享页和轻 API。
- Supabase 承载 Postgres、Storage、Queues、Edge Functions。
- 微信小程序只调用服务端 API，不直连模型或核心数据库。
- 本机仅用于流程效果、美工确认和微信开发者工具真机预览。

## 目录

```text
apps/
  web/                 Next.js Web预览、运营后台、分享页、轻API
  miniprogram/         微信小程序体验入口，只调用服务端API
packages/
  contracts/           OpenAPI/JSON Schema/Zod类型入口
supabase/
  migrations/          Supabase数据库迁移
  seed/                MVP样例题库
  functions/           Edge Functions草稿
docs/
  adr/                 架构决策
  deployment/          环境与发布计划
  goals/               长程目标合同
  verification/        阶段验收记录
output/                产品预览图等交付物
```

## 本机验证

```powershell
pnpm install
pnpm verify
```

AI防泄题黄金集：

```powershell
pnpm test:ai-golden
```

评分黄金集：

```powershell
pnpm test:grading-golden
```

目录匹配契约：

```powershell
pnpm test:catalog-contract
```

小程序契约检查：

```powershell
pnpm test:miniprogram-contract
```

Supabase 云端契约检查：

```powershell
pnpm test:supabase-contract
```

Hosted Supabase dev smoke (optional; writes dev rows only when explicitly enabled):

```powershell
pnpm test:supabase-hosted-smoke
```

运行时密钥边界检查：

```powershell
pnpm test:runtime-contract
```

报告/错题/分享边界检查：

```powershell
pnpm test:report-contract
```

分享海报边界检查：

```powershell
pnpm test:share-edge-cases
```

后台复核流转检查：

```powershell
pnpm test:review-workflow
```

题库导入合同检查：

```powershell
pnpm test:paper-import
```

该检查覆盖 dry-run 校验、`replace_preview` 冲突策略、accepted import commit、30 道题、30 个答案键和 8 组 rubric 行。

部署合同检查：

```powershell
pnpm test:deployment-contract
```

PRD 追踪矩阵检查：

```powershell
pnpm test:prd-traceability
```

存储后端切换检查：

```powershell
pnpm test:store-backend
```

本地预览：

```powershell
pnpm dev
```

- 首页：`http://127.0.0.1:3000`
- 运营后台：`http://127.0.0.1:3000/admin`
- MVP题库预览：`http://127.0.0.1:3000/admin/papers/paper_2010_sd_math_sci_mvp`
- 题库导入演练：`http://127.0.0.1:3000/admin/papers/import`，支持 dry-run 校验和 dev/memory accepted import commit
- 考试流程预览：`http://127.0.0.1:3000/exam`
- 分享页预览：`http://127.0.0.1:3000/share/{shareToken}`
- 分享海报：分享卡会生成 1080x1440 PNG；本地 memory 模式为 data URL，Supabase 模式写入 `share_cards.object_url`
- AI复核队列：`http://127.0.0.1:3000/admin/review-queue`
- 健康检查：`http://127.0.0.1:3000/api/health`
- 用户侧公开试卷API：`http://127.0.0.1:3000/api/v1/papers/{paperId}`
- 题库API：`http://127.0.0.1:3000/api/catalog/papers`
- 批改任务API：`http://127.0.0.1:3000/api/v1/grading-jobs/{jobId}`
- 分享卡API：`http://127.0.0.1:3000/api/v1/reports/{reportId}/share-cards`
- 公开分享API：`http://127.0.0.1:3000/api/v1/share/{shareToken}`
- AI复核队列API：`http://127.0.0.1:3000/api/v1/admin/review-queue`
- 人工调分API：`http://127.0.0.1:3000/api/v1/admin/review-queue/{reportId}/score-adjustments`
- 题库导入API：`http://127.0.0.1:3000/api/v1/admin/paper-imports`
- 小程序工程：`apps/miniprogram`
- 小程序导入说明：`docs/deployment/miniprogram-devtools.md`
- 云端部署门槛：`docs/deployment/cloud-deployment-gates.md`
- 运行时存储契约：`docs/deployment/runtime-storage-contract.md`

## 安全边界

- 不把 `SUPABASE_SERVICE_ROLE_KEY`、AI key、微信 `AppSecret` 放进小程序或浏览器。
- 考试会话、答案保存、交卷、AI辅导和评分全部走服务端 API。
- 交卷必须使用幂等键，只生成一个批改任务。
- 首次 AI 辅导前必须保存 `pre_ai_answer_version`。
- 正式上线前必须补齐备案域名、HTTPS、小程序隐私指引、AI生成内容标识和 AI估分免责声明。
