# ADR 0001: Cloud-first GitHub + Vercel + Supabase

## Status

Accepted for MVP planning.

## Context

“高考新生”需要快速验证完整体验闭环，同时保留后续小程序正式上线、AI评分审计和题库运营能力。本机不应成为后端状态来源，只用于流程效果和美工确认。

## Decision

- 使用 GitHub monorepo 管理所有产品、后端、数据迁移和文档。
- 使用 Vercel 部署 Next.js Web 预览、运营后台、分享页和轻 API。
- 使用 Supabase 管理 Postgres、Storage、Queues、Edge Functions。
- 微信小程序只调用服务端业务 API，不直连模型、不持有服务端密钥、不直接写核心表。
- AI评分与报告生成通过异步队列推进，交卷接口只创建幂等任务。

## Consequences

- 好处：Preview URL 可快速验收，数据库 schema 可版本化，MVP 不依赖本机长驻服务。
- 代价：正式小程序上线前仍需处理备案域名、HTTPS、隐私指引、AI生成内容标识和微信审核材料。
- 迁移路径：如国内生产访问或审核受阻，可把 API 层迁到腾讯云/云托管，保留数据模型和业务边界。

## References

- Vercel Git deployments and Preview deployments.
- Supabase migrations, multi-environment workflow and Queues.
- 微信小程序网络合法域名和 HTTPS 要求。
