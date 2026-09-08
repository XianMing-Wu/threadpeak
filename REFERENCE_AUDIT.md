# 当前参考与迁移审计

用户最新裁决为最高权威。[产品目标](as-implemented-logic.md)、[Agent 合同](agent-specs.md)与 [AGENTS](AGENTS.md)约束实现；参考画面、旧源码与测试不能反向覆盖目标。

| 参考 | 使用范围 | 当前落点 |
| --- | --- | --- |
| 用户确认的 ux-ui | 白色双栏、研究/知识脉络、浮动提问、编辑跳文档、正交树 | src/learning-v2 |
| ponder-dialog-replica | 添加同级/子级、节点菜单、颜色、画布/文档呈现 | Graph、NodeEditor、Document、tree |
| 相对完整的视频.mov | 局部占位、流式正文、已完成内容持续可读 | 持久任务与页面状态；录屏不能证明参考服务零故障 |
| 旧主项目路线/3D | R1–R4 合同、文档 renderer 与不透明进度 | durable/flows、project-document、server-progress-storage |
| 旧主项目作者逻辑 | Zhihu-first 与 network-first 的证据顺序 | A-card-plan/select、N0–N2；旧批注不再是目标 |

默认入口为 server/durable。首次回复按文章拆成单依据段落，新对话清空聊天但保留树；问博主找 1–3 位新作者，最多 3 位，不声称实际向作者发信；刘看山不是博主。真实 provider/真实数据要求适用于全部用户触发的请求，旧示例只作示例。

配置权威是 [.env.example](.env.example) 与 [部署手册](deploy/README.md)。服务端 provider 字段为 DEEPSEEK_API_KEY、DEEPSEEK_BASE_URL、DEEPSEEK_MODEL_NAME、DEEPSEEK_CONTEXT_TOKENS、ZHIHU_ACCESS_SECRET、ZHIHU_API_BASE_URL。ZHIHU_OAUTH_APP_ID、ZHIHU_OAUTH_APP_KEY、ZHIHU_OAUTH_REDIRECT_URI 用于当前可配置 OAuth 适配器；本地演示允许显式 mock，真实授权仍须验收。

## 当前未达到的完成条件

本地真实 provider 链路、PGlite 和 PostgreSQL 验收分别记录于[执行记录](docs/backend-rebuild-2026-09-06.md)。它们不能证明生产身份、实际域名、真实用户负载与内容质量已经达到上线要求。原审计保留在 [历史记录](docs/archive/before-learning-v2-REFERENCE_AUDIT.md)，其中旧 canonical 根/G1/G2/批注段落不再是当前合同。

旧源码的并行实现和客户端图生成已在[本轮架构审查修复](docs/architecture-review-fixes-2026-09-07.md)删除。历史兼容备忘移至 `docs/archive/compatibility/`，不再放在活动源码目录。
