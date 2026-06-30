# 高考新生 Cloud-First MVP Goal

## Goal

把“高考新生”做成一个云端优先开发、可预览、可验收、可继续扩展的 MVP：GitHub 作为代码真源，Vercel 承载 Web 预览、运营后台、分享页和轻 API，Supabase 承载 Postgres、Storage、Queues/RPC 与后续 Edge Functions，微信小程序作为真实体验入口，本机只用于流程效果、美工确认和微信开发者工具真机预览。

## Intent

用户真正要的不是一份静态方案，而是一条可以直接进入 GitHub、Vercel、Supabase 与微信小程序开发的产品跑道。它必须让后续执行者知道先做什么、不能碰什么、怎么证明完成，避免把“本地 Demo 可跑”误判成“云端架构已完成”。

## Strategic Outcome

- 产品层：形成一个可展示给学生/家长/合作者看的高考重做、AI 辅导、AI 估分、报告分享闭环。
- 工程层：形成一个云端可迁移、可预览、可回滚、可审查的 monorepo，而不是散落在本机的临时页面。
- 运营层：后台可以管理题库、查看 AI 复核队列、沉淀分享素材和验收证据。
- 风险层：小程序和浏览器不接触 Supabase service-role key、AI key、微信 AppSecret 或标准答案私密字段。

## Decision Standard

当速度、范围、质量发生冲突时，按以下顺序取舍：

1. 先保密钥边界、数据权限和评分证据，不为速度牺牲安全。
2. 先完成一张数学 MVP 精选卷闭环，不扩张到全国全科全卷。
3. 先云端可迁移、可烟测，再考虑更多 AI 模型、复杂推荐和增长玩法。
4. 先让微信小程序调用服务端 API，不让小程序直连模型或核心数据库。
5. 先保留人工确认门槛，GitHub push、Vercel/Supabase 账号绑定、生产部署和付费资源都不得自动执行。

## Evidence Standard

本地阶段必须提供：

- `pnpm verify` 通过，覆盖 lint、typecheck、AI 黄金集、评分黄金集、运行时密钥边界、存储后端、Supabase 合约、小程序合约和 Next build。
- `output/gaokao-xinsheng-product-preview.png` 或同级产品预览图可打开。
- `docs/verification/M*.md` 记录每个阶段的完成证据。
- `docs/deployment/*.md` 记录环境变量、云端部署门槛和运行时存储切换规则。

云端阶段必须提供：

- GitHub repo URL、CI run URL、分支/PR URL。
- Vercel Preview URL，`/api/health` 返回安全状态。
- Supabase dev project ref、migration history、表/RLS/队列/bucket 检查结果。
- `pnpm test:supabase-hosted-smoke` 在 dev Supabase 上通过，且输出不包含密钥。
- 微信开发者工具导入截图、真机截图、合法域名配置截图和隐私/AI 提示审查材料。

## Scope

本轮 MVP 包含：

- Next.js Web：首页产品预览、考试流程、报告页、分享页、运营后台、AI 复核队列。
- API：试卷公开读取、会话创建/开始/保存答案、AI 辅导、交卷评分、评分任务、报告、分享卡、公开分享、复核队列。
- Supabase：核心表、RLS、迁移、`grading_jobs` 队列/RPC、`review_queue` 视图、`share-cards` storage bucket、服务端适配器。
- 微信小程序：入口页、考试页、报告页、分享页，只调用服务端 API。
- 验证：本地合同检查、黄金集、构建、可选 hosted Supabase dev smoke。

## Non-goals

- 不在第一阶段追求全国全科、全年份、全真卷覆盖。
- 不做排行榜、社区、学校录取概率预测、心理疗愈或支付系统。
- 不让小程序直连 AI 模型、Supabase service-role 或核心写表。
- 不把正式数据、密钥、token、AppSecret 写进仓库、日志、报告或小程序包。
- 未经用户明确确认，不 commit、不 push、不创建 PR、不部署生产、不运行 hosted migration、不购买或启用付费资源。

## Context to Read First

后续执行者开始前必须先读：

- `README.md`
- `docs/goals/cloud-first-mvp.md`
- `docs/deployment/environment-plan.md`
- `docs/deployment/cloud-deployment-gates.md`
- `docs/deployment/runtime-storage-contract.md`
- `docs/deployment/miniprogram-devtools.md`
- `docs/verification/cloud-readiness.md`
- `supabase/migrations/*.sql`
- `apps/web/src/lib/runtime-config.ts`
- `apps/web/src/lib/exam-store-backend.ts`
- `apps/web/src/lib/supabase-exam-store.ts`
- `apps/miniprogram/env.js`

## Constraints

- 本机默认使用 `EXAM_STORE_BACKEND=memory`，只做流程和 UI 确认。
- 云端持久化必须使用 `EXAM_STORE_BACKEND=supabase` + `SUPABASE_STORE_ADAPTER_ENABLED=true` + server-only Supabase env。
- `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 默认不得引入，除非未来单独做 RLS 评审。
- `/api/health` 只能暴露缺失变量名和状态，不得暴露变量值。
- hosted smoke 只允许在 dev Supabase 执行，因为它会写入测试行。
- 任何生产账号、付费资源、数据库破坏性迁移、真实用户隐私数据处理都必须暂停等用户确认。

## Execution Policy

1. 先读当前文档、代码和验证脚本，确认工作区状态。
2. 每个阶段只推进一个可验收切片，改动必须能追溯到本 goal。
3. 代码改动优先沿用现有 monorepo、Next API、Supabase migration、服务端 store facade 和小程序 API client。
4. 本地验证通过后才能记录阶段完成；云端验证缺失时只能标记为“本地就绪”，不得说“已上线”。
5. 需要外部账号写操作时暂停：GitHub remote、Vercel link/env、Supabase project/migration、微信体验版上传。
6. 不自动提交、不自动推送、不自动部署；只有用户明确说“提交/推送/部署/继续”才执行对应高风险动作。

## Milestones

- M1 云端骨架：monorepo、CI、Vercel/Supabase 目录、环境变量样例、部署门槛。
- M2 题库与后台：MVP 数学卷、后台题库预览、公开试卷 API 不泄露答案和 rubric。
- M3 考试闭环：会话、开始、保存、恢复、交卷和本地体验页面。
- M4 AI 辅导：L1-L4 提示、pre-AI 答案快照、防泄题黄金集。
- M5 AI 估分：评分任务、逐题证据、低置信复核、黄金集。
- M6 报告与分享：报告页、分享卡、公开分享页、分享字段可见性控制、复核队列、隐私边界。
- M7 小程序入口：微信原生页面、API 调用、DevTools 导入说明、真机验收清单。
- M8 云端切换：Supabase 服务端适配器、hosted dev smoke、Vercel Preview health、云端证据归档。

## Checkpoints

每个 milestone 至少提交：

- 影响文件清单。
- 验证命令和结果。
- 截图或预览图。
- 已知风险。
- 下一步是否需要用户授权。

AI 阶段额外提交：

- 黄金集结果。
- 泄题/误判失败样例。
- Prompt/模型版本。
- 成本和速率限制估计。

云端阶段额外提交：

- GitHub/Vercel/Supabase/微信 DevTools 的真实证据链接或截图。
- `api/health`、公开试卷 API、hosted Supabase smoke 输出。
- 任何尚未验证的事项，不得伪装成已完成。

## Verification

默认本地验证：

```powershell
pnpm verify
```

可选 hosted Supabase dev smoke：

```powershell
$env:SUPABASE_HOSTED_SMOKE="1"
$env:EXAM_STORE_BACKEND="supabase"
$env:SUPABASE_STORE_ADAPTER_ENABLED="true"
$env:SUPABASE_URL="<dev project url>"
$env:SUPABASE_SERVICE_ROLE_KEY="<service role key>"
pnpm test:supabase-hosted-smoke
```

人工验收：

- 打开产品预览图确认整体叙事与美术方向。
- 本地访问 Web 首页、后台、考试页、报告页、分享页和复核队列。
- 用微信开发者工具导入 `apps/miniprogram`，配置真实 `appid` 和 Vercel HTTPS 后真机预览。

## Stop Conditions

- 发现密钥、token、AppSecret、service-role key 泄露风险。
- RLS、服务端鉴权或公开 API 字段边界不明确。
- AI 低级提示泄露最终答案。
- 评分结果无法引用得分点证据。
- hosted smoke 被指向生产项目。
- 需要创建/绑定外部账号、运行 hosted migration、推送代码、上传小程序、购买资源或处理真实用户隐私数据。
- 同一验证失败连续三次且没有新的证据。

## Final Report

完成时必须报告：

- 改动概览和关键文件路径。
- 产品预览图路径。
- Goal 文档路径。
- 本地验证结果。
- 云端仍缺的证据。
- 下一步需要用户确认的外部动作。
