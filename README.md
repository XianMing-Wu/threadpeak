# ThreadPeak

React/Vite 前端与 Fastify 持久 Agent 工作流。默认服务入口是 `server/durable`，学习页采用已确认的 ux-ui 文章、单父卡片树、文档和聊天交互。当前已有本地真实 provider 联调证据，生产身份接入与上线指标仍待验收；测试通过不能证明产品零故障。

## 启动

需要 Node 24+、npm。PDF 通过知乎异步解析 API 处理，默认资料管线不依赖本机 `pdftotext`。

```sh
npm ci
cp .env.example .env
npm run server
npm run dev
```

在 `.env` 填入服务端 provider 配置。默认 API 4312、Vite 4301；可用 `THREADPEAK_PORT` 与 `THREADPEAK_API_TARGET` 改端口。本地数据位于 `server/.data/product-v2`；本地工作区使用隔离 cookie，清除 cookie 会失去该匿名身份，因此不应用于正式用户。生产部署见 [运行手册](deploy/README.md)。

## 数据与流程

- 路线：R1 → 按搜索范围读取资料 → R2 → R3/R3b 最多三轮 → R4 顺序/并列阶段 → 程序编译 → renderer 校验后发布。选择题确认后保持可见，答完自动生成；继续任务只恢复未完成步骤。
- 学习：三路概念搜索 → 过滤相关文章 → 三角度直答 → L-answer。首次回复的各段挂在对应文章后，每段通过 append_cards 指定一个范围内依据卡。
- 首页输入框中，范围图标位于附件图标左侧：全知乎、全网、仅知乎收藏夹（多选）。附件在输入框顶部按行展示；范围和本次资料在创建路线时固定，并继承至每个概念。收藏只记兴趣，后续主动使用与帮助反馈影响对应主题偏好。设置中也可导入公开创作或最近收藏。
- 全网同时调用知乎搜索和 global_search，保留 CSDN 等网站的标题、内容和溯源链接；仅知乎来源进入博主网络。仅收藏夹使用所选收藏与文件，不外搜，三角度讲解通过实际 LLM 阅读这些资料。
- 公式在聊天、文章、卡片和文档统一渲染，编辑时保留原始 LaTeX；无法还原的损坏内容不猜补。
- 研究、知识脉络与文档读取同一服务端资源。新对话归档旧聊天、当前清空，文章与树保留。编辑的是展示副本，原始文章总结保留。
- 问博主检索 1–3 位新作者的公开文章并生成卡片；零合适才刘看山直答。不会联系作者。博主搜索遵循 network-first，先读取来源网络并探索新证据；相关性优先，同级时参考主题反馈，最多 3 位。结果支持 Coverflow 卡片拖动、键盘切换和减少动效。刘看山不是博主，不入作者网络。
- 模型、知乎/全网搜索、直答与 PDF 使用真实 provider；仅用户明确指定的本地 OAuth/用户 API 可切换演示适配器，演示不填补真实服务失败。MCP 可作为外部工具适配，内部步骤由程序固定编排。

任务、检查点、资源版本、事件与作者关系持久保存；租约/fence 阻止迟到结果，最终聊天/卡片事务提交。外部调用可能重试，不能声称 exactly-once。调用副本按 provider 窗口压缩，原文不覆盖；摘要保留来源并按账号缓存。

## 配置

仅服务端可读：`DEEPSEEK_API_KEY`、`DEEPSEEK_BASE_URL`、`DEEPSEEK_MODEL_NAME`、`DEEPSEEK_CONTEXT_TOKENS`、`ZHIHU_ACCESS_SECRET`、`ZHIHU_API_BASE_URL`。生产还需 `DATABASE_URL`、`THREADPEAK_PUBLIC_ORIGIN`、`THREADPEAK_IDENTITY_SECRET`、`THREADPEAK_IDENTITY_ISSUER`、`THREADPEAK_IDENTITY_AUDIENCE`；登录跳转用 `THREADPEAK_LOGIN_URL`。

端口/数据路径：`THREADPEAK_PORT`、`THREADPEAK_HOST`、`THREADPEAK_DATA_DIR`。Compose 使用 `POSTGRES_PASSWORD`、`SITE_ADDRESS`。`ZHIHU_OAUTH_APP_ID`、`ZHIHU_OAUTH_APP_KEY`、`ZHIHU_OAUTH_REDIRECT_URI` 配置知乎应用；还需 `ZHIHU_OAUTH_USERINFO_URL`、`ZHIHU_OAUTH_USER_ID_PATH` 及 `THREADPEAK_TOKEN_SECRET`。名称和头像映射可用 `ZHIHU_OAUTH_USER_NAME_PATH`、`ZHIHU_OAUTH_USER_AVATAR_PATH`。用户信息接口合同、state 回传及真实授权仍待知乎应用获批后验收，详见[资料与账号接入](docs/materials-zhihu-integration-2026-09-06.md)。所有示例配置值为空，真实 `.env` 不提交。

## 本地演示知乎账号

在 `.env` 设置 `ZHIHU_OAUTH_MODE=mock` 后重启 API，可从账号菜单或范围菜单连接演示账号，体验收藏夹、公开创作和资料学习。演示使用同一授权回调、接口结构、所有者校验和导入任务；账号与文章标明演示，并与真实身份分开。它不会模拟模型、搜索或 PDF，也不会向知乎发送演示令牌。`NODE_ENV=production` 拒绝此模式。

获批后把模式改为 `real`，填写前述 OAuth 配置和官方用户信息字段映射后重启。前端无需替换接口；真实授权、回调 state 和字段映射仍须联调。旧演示会话失效，演示资料不会并入真实账号。本次本地预览已启用 mock，详细验收见[范围、公式与博主卡片](docs/search-scope-formulas-coverflow-2026-09-06.md)。

## 检查与证据

```sh
npm run check
npm test
npm run build
npm run test:durable
# 只允许明确隔离的 threadpeak_test 数据库
npm run test:postgres
```

PostgreSQL gate 从 `TEST_DATABASE_URL` 读取连接；不得传正式库。`npm run ops:queue` 只输出任务状态/错误类别计数，不输出用户正文或秘密。旧 orchestrator 测试仍保留，但默认生产入口不注册旧 G1/G2、批注接口。真实执行范围与当次证据见 [重构记录](docs/backend-rebuild-2026-09-06.md)，不能用旧测试数量代替新链验收。

## 当前明确未完成

实际域名/服务器与生产身份签发方接入；正式用户规模下的延迟/成本/压缩质量指标；无官方 authorId 时的跨文章作者身份完备性；数据保留/删除政策及大规模不可压缩骨架分区。详见 [现状与上线缺口](as-implemented-logic.md)。

合同权威：[agent-specs.md](agent-specs.md)、[as-implemented-logic.md](as-implemented-logic.md)、[AGENTS.md](AGENTS.md)。参考迁移见 [REFERENCE_AUDIT.md](REFERENCE_AUDIT.md)。
