# ThreadPeak 参考、当前实现与重构目标审计

本文件只做三件事：记录参考视觉、标出当前源码落点、说明它们要被什么目标替换。它不是第三份产品规范，也不把参考项目的模块名或旧源码结构升级成重构合同。

## 权威与证据边界

| 内容 | 本审计怎样使用 |
| --- | --- |
| 当前用户裁决 | 最高权威 |
| [`as-implemented-logic.md`](as-implemented-logic.md) | 第 1 节作为当前现场，第 2 节和第 4.1 节作为目标，第 3 节作为差距账本，第 4.2 节作为未裁决清单 |
| [`agent-specs.md`](agent-specs.md) | Agent 上下文、压缩、系统提示词和输出结构的唯一详细来源 |
| [`AGENTS.md`](AGENTS.md) 与 [`.cursor/rules/`](.cursor/rules/) | 实现范围和验证路由 |
| 现场源码、测试和本文件 | 当前证据；不能覆盖目标，也不能单独证明完成 |

旧算法文档、PRODUCT_SPEC、状态机、参考仓库、截图和 fixture 可以帮助定位历史设计，但与上述目标冲突时不能反向改写目标。

## 审计标签

| 标签 | 可以说明什么 | 不能说明什么 |
| --- | --- | --- |
| `visual-reference` | 颜色、尺寸、布局或交互参考 | 数据结构、调用顺序、持久化 |
| `current-code` | 现场源码现在怎样运行 | 这种行为就是正确目标 |
| `specified-target` | 两份重构文档已经写清的行为 | 现场已经实现 |
| `unresolved` | 用户尚未裁决，实施时会猜 | 可以由 README、旧规则或测试自行补齐 |
| `implemented` | 现场代码实现目标且有对应自动验证 | 已接通真实外部依赖和永久存储 |
| `integrated` | 一条真实前后端/provider/数据链纵向跑通 | 全产品 production-ready |

## 当前源码与目标替换

| 当前源码落点 | 当前事实 | 已确认重构目标 |
| --- | --- | --- |
| `server/agent-runtime/` | 共用上下文组装、500k/300k 压缩、输出校验和真实 DeepSeek/知乎端口已存在；产品 HTTP 尚未改走该运行时 | 所有 Agent 共用同一套预算/压缩/校验后再进入各域编排；用户请求不得回退 fixture |
| `src/pages/AuthLanding.tsx`、`src/resolve-auth-session.ts`、`server/identity/` | 知乎授权会请求官方地址；缺配置明确失败；进入本地原型只设置本机开关；用户协议/隐私政策只是无内容文字 | 保留授权与进入本地原型两条入口；不假登录；删除无内容的协议/隐私项 |
| `src/components/Shell.tsx`、`src/history.ts`、`src/resolve-history-reopen.ts` | 侧栏历史主要是本地草稿；Chat 只带发送上下文重开；账号菜单没有设置入口 | 学习历史点哪条开哪条；Chat 历史原样恢复整段对话；清历史只清列表；账号菜单增加设置 |
| `src/pages/Home.tsx`、`src/components/Composer.tsx` | 首页只有路线/图文快捷；附件与资料范围只报错；建议芯片只填字；思考深度不进请求 | 不增加首页问博主；芯片选中路线模式并填字、不发送；只在首页上传 pdf/md/txt；资料范围继续失败；只有快速/深度 |
| `src/pages/Chat.tsx`、`src/path-planning/`、`server/path-generation/` | 产品路线制定走 R1–R4 `/api/path-runs`；旧 CandidateSet stream 仍在 `server/path/` 标为 prototype | R1/R-S/R2/R3/R3b/R4；最多 3 轮；校验后发布且不建知识；Composer 一直存在；发布后普通发送走 R5 |
| `src/pages/Collections.tsx`、`src/path-3d/`、`src/components/Path3D.tsx` | 我的路线只显示校验文档；3D 返回按来源；位置只在本次打开保留 | 空态回首页并选中路线模式；全部 3D 返回路线列表；边不锁节点；每条路线恢复上次位置，具体字段仍未裁决 |
| `src/pages/Session.tsx`、`server/knowledge/` | 首次回复走旧普通回答；成功后另请求 GraphSurgeon 建根；图失败仍可能保留首次回复；永久性只在进程内存 | L0a 三路并联直答 → L0b；canonical 首次回复与确定性唯一根作为同一成功结果，根不再调用 LLM，并永久复用 |
| `src/session/`、`src/knowledge-canvas/` | 追问按检索→分类→回答串行；整图纯文本；前端本机长图；点节点会影响宿主；画布回对话入口不完整 | 显式引用/默认最近回复决定宿主；G1 邻域 JSON 与 G2 当前 conversation 全文并发；双成功才长图；画布与最新对话实时同步 |
| `src/session/ask-authors.ts`、`resolve-ask-author.ts`、`server/http.ts` | 单次检索后挑作者；找到后会在本机另长并列节点；零作者直达没有目标中的完整 A1/A2/A3 合同 | 有效划选 + 问题 → A1 2–3 问 → A-S 并联 → A2 选 1–2 位；零位才 A3；只形成批注；真实作者高权入网 |
| `src/pages/Authors.tsx`、`src/session/author-graph-rag.ts`、`resolve-author-search.ts` | 网络投影未接通会整次失败；旧设计是网络有命中就停、零命中才知乎；搜索结果不入网；网络 Tab 只显示失败 | N0 高权→低权；合计不足 3 人才 N1/N-S/N2 补位；候选不足全部返回；知乎新作者低权入网；网络有人列名单、没人显示空态 |
| `src/pages/Settings.tsx`、`src/resolve-settings-identity.ts` | 身份和资料没有 provider 时明确失败；页面仍有密度、减少动效和默认思考深度 | 保留退出、夜间模式、清空历史、身份、资料；删除密度、减少动效、默认思考深度 |
| `src/visuals/`、图文分支 | 图文发送只会失败，不产生用户 artifact | 在真实图文编排未裁决前继续明确失败，不得用 fixture 假成功 |
| `path-lab.html`、`src/path-lab/`、`/api/paths/generate` | 已从源码删除 | 产品路线制定只走 Chat `/api/path-runs` |
| `packages/contracts`、`packages/api-client`、`packages/runtime-store` | 已有部分 Zod、decoder 和 headless store，可用于迁移 | 它们是工程材料，不代表 R1–N2、持久化或恢复已经接通 |

上表的“当前事实”来自当前审查基线，不是允许保留的产品行为。源码更新后应同步本表，不能把历史现状写成永久说明。

## 已确认产品链路

| 领域 | 固定顺序或不变量 |
| --- | --- |
| 路线 | R1 4–5 问 → R-S 并联 → R2 探索 JSON → R3/R3b 最多 3 轮 → R4 稳定 ID/显式边 → renderer 校验 → 发布；发布不建知识 |
| 首次学习 | L0a 三路知乎直答并联 → L0b 整理 → canonical 首次回复与确定性图/根同一成功状态；再次进入和新对话永久复用 |
| 学习追问 | 问题必填；引用决定宿主，否则最近成功 LLM 回复；G1/G2 同时开始；只有两路成功才新增卡 |
| 问博主 | 划选后 A1 2–3 问 → A-S 并联 → A2 从输入 ID 选 1–2 位 → 正常零位才 A3 刘看山；结果只做批注 |
| 博主搜索 | network-first：N0 高权→低权；不足 3 才查知乎；最终最多 3 位，候选不足全部返回；知乎作者低权入网 |
| 刘看山 | 只作零作者时的直达回退，不是博主，不创建 AuthorIdentity、候选或网络节点 |
| 3D | 所有节点可进入；边只推荐流转；走到这里不建会话或知识；学习会话返回 3D，3D 返回路线列表 |

## Agent 与非 Agent 边界

- Agent：R1、R2、R3、R3b、R4、R5、L0a、L0b、G1、G2、A1、A2、A3、N1、N2。
- 非 Agent：R-S、A-S、N-S 知乎搜索，N0 Graph RAG，GraphSurgeon 根创建，3D 文档校验，题目展示、G1/G2 汇合和批注展示。
- 每个 Agent 的完整上下文、500k/300k 压缩、系统提示词和输出结构只在 [`agent-specs.md`](agent-specs.md) 维护。本审计不复制第二套提示词或 schema。
- R2 的中文动态键对象不能进入 renderer；只有 R4 最终路线 JSON 可以发布。

## 附件、深度和上下文边界

- 只有首页能上传 pdf/md/txt。路线各 LLM 都带本次附件；首页普通 Chat 的附件只跟随该 Chat；R4 把相关信息和 sourceId 写进概念 detailedDescription；学习阶段没有附件。
- 每次主调用的总预算为 500k。达到或超过预算时按 Agent 专用规则压缩，直到低于 500k；不能返回“压缩后仍过长”。
- 附件分支以非附件部分 300k 为界：`<300k` 先压附件一次，`>=300k` 压非附件。
- G1 保持 host/siblings/predecessors/successors 和边结构，只压节点回复；G2 只压当前这一次对话，不混入同概念其他历史对话。
- 思考深度只有快速/深度且默认快速。深度生效时，该流程全部 LLM 与知乎直答都使用深度；学习页与画布同步，离开后恢复快速，首页深度不带进学习页。

## 视觉参考映射

视觉参考只定义外观方向，不能定义 Agent、数据写入或检索顺序。

| 参考 | 可借用 | 不得从中推导 |
| --- | --- | --- |
| `zhihu_ux_ui/` | 1280×720 桌面框、220px/64px 侧栏、知乎蓝、浅色内容面、Composer 视觉 | 身份、附件提交、模式状态和业务流程 |
| 旧 3D runtime | WebGL 场景、载体/概念的视觉层级、受控卡片交互 | 节点解锁、学习进度、路线生成和知识写入 |
| `thread-chatbot` | 点阵画布、Markdown 卡、曲线边、缩放和拖动语法 | 点击选宿主、从布局造边、浏览器存储作为知识真相 |
| `icons-v15.svg` | 统一图标精灵和 24×24 keyline | 产品中不存在的新入口或动作 |

仍可保留的视觉基线：桌面视口 1280×720、主侧栏展开 220px/收起 64px、首页输入区最大宽 712px且高度至少 116px、主蓝 `#1772f6`、低对比边界 `#e8eaed`/`#eceef1`。这些数值只用于当前桌面视觉验收，不证明移动端或生产可用性。

## 真实 provider 与配置证据

项目根 [`.env.example`](.env.example) 应只包含下列空值键：

```text
ZHIHU_ACCESS_SECRET
ZHIHU_API_BASE_URL
DEEPSEEK_API_KEY
DEEPSEEK_BASE_URL
DEEPSEEK_MODEL_NAME
ZHIHU_OAUTH_APP_ID
ZHIHU_OAUTH_APP_KEY
ZHIHU_OAUTH_REDIRECT_URI
```

- 配置只由服务端读取，不进入 React/Vite bundle、浏览器、日志或错误响应。
- 用户请求使用真实知乎与真实 LLM/直答 provider；缺配置、鉴权、限流、超时或无效结构都明确失败。
- mock、fake、fixture 和示例只能用于隔离测试或明确示例展示，不能替代用户请求。
- 文档列出配置名、服务存在或 `/ready` 通过，不能证明目标 Agent 编排、永久存储或 live-provider gate 已完成。

## 尚未裁决，不能从参考补出来

- R5 失败重试、历史落盘等普通 Chat 完整目标管线；真实图文编排。
- 首次回复和根的持久化表、唯一作用域、跨重启事务与并发策略。
- 附件大小、数量、解析失败、删除、重复文件与 sourceId 生命周期。
- 各流程的请求身份、重复提交、取消、超时、部分失败、刷新恢复和迟到响应。
- 首页深度是否带入随后打开的 Chat，以及运行中切换的冻结点。
- OAuth 授权拒绝、state 失配和会话过期等回调状态。
- 芯片最终文案、独立 404 视觉、3D 位置字段/写入时点和博主网络最终拓扑。

不得把 PostgreSQL、RLS、CAS、outbox、SSE、worker、job/lease、某个 SDK 或旧参考仓库的实现写成已经裁决的唯一方案。

## 当前未达到的完成条件

- 当前路径仍是一次 CandidateSet 加本地剪枝，不是 R1–R4。
- 当前首次学习仍把 canonical 首次回复和建根拆成两个请求/状态，不是同一个成功结果。
- 当前追问仍是串行旧管线和本地长图，不是 G1/G2 并发。
- 当前问博主与博主搜索未完成 A1–A3、N0–N2、高权/低权写入和批注边界。
- 当前附件、思考深度、历史、设置、返回关系、独立 404 和 path-lab 清理仍有账本差距。
- 当前内存 store、浏览器草稿、fixture、schema 或 renderer 测试都不能证明 canonical 永久性、真实 provider、跨重启恢复、权限隔离或 production-ready。

更新本审计时必须同时核对两份重构文档、AGENTS、匹配规则、现场源码和当次验证结果。只完成文档同步时，只能报告文档一致，不能报告产品已经实现。
