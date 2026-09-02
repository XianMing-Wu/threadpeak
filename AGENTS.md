# ThreadPeak Agent 入口

本文件是 `threadpeak-ux-ui/` 的**始终加载入口**。它只保留权威关系、不可违反的产品语义和渐进式规则路由；详细架构已经拆入 [`.cursor/rules/`](.cursor/rules/)，由 Cursor 根据正在查看或修改的文件自动附加。

不要为了省事一次性读取全部规则。先确定任务涉及的文件，再读取所有匹配规则；一个文件匹配多条规则时必须合并执行，不能任选其一。

## 1. 权威与适用范围

当前用户明确要求拥有最高权威。本文件与 `.cursor/rules/*.mdc` 共同约束本目录及其未来的 `apps/`、`packages/`、`server/`。

| 维度 | 权威来源 |
| --- | --- |
| 当前用户已裁决产品语义 | 本文件第 2 节；旧文档、fixture、截图和源码不得反向覆盖 |
| 领域字段、状态机、不变量、HTTP、持久化语义 | [`../算法/知识脉络/知识脉络图设计算法.md`](../算法/知识脉络/知识脉络图设计算法.md)、[`../算法/路径生成/最小学习路径算法部分.md`](../算法/路径生成/最小学习路径算法部分.md) 与唯一 runtime Zod [`packages/contracts`](packages/contracts/src/runtime-contracts.ts)；旧 `../算法/shared/runtime-contracts.ts` 只允许 re-export |
| 模块所有权、依赖方向、代码风格、迁移和发布门禁 | 本文件 + 匹配的 `.cursor/rules/*.mdc` |
| 可见功能、术语、页面和交互事实 | `../PRODUCT_SPEC.md`、`../threadpeak-state-machines/` 与参考图 |
| 当前实现/测试状态 | 现场源码和当次命令输出；历史数字不能证明现在完成 |

领域含义、跨包 API、数据所有权、状态机边或事务边界发生变化时，先同步权威合同并记录 ADR，再写生产代码。若当前用户裁决与旧算法/产品文档冲突，以用户裁决为准，但必须先同步相关权威文档，不能在冲突仍存在时新增生产写链。

## 2. 已裁决产品不变量

以下内容不是待讨论方案：

1. **路线不创建知识脉络。** 用户通过已校验 handoff 第一次进入概念时，先生成并 settle 该概念唯一的 canonical 初始回复；随后才可依据它创建 `KnowledgeGraph` 与唯一根节点。
2. **首次回复永久保留。** 再次进入、新开对话、归档、reopen、刷新、模型升级或图谱修复都只能引用同一 canonical 初始回复，不得重新生成、替换或覆盖。只有明确的数据删除/合规流程可以删除或匿名化，并保留必要审计 tombstone。
3. **问博主固定 Zhihu-first。** 知乎站内搜索多个真实用户及回答/内容 → 稳定身份归一与逐作者 evidence pack → LLM 只在给定候选中选 1–2 位；零可信作者时由刘看山调用知乎直达。禁止联系 proposal、私信、代发、虚构作者或凑数。
4. **博主搜索固定 network-first。** 先查当前用户博主图谱；有相关作者就最多返回 3 位并停止。只有零相关命中才查知乎、去重并由 LLM 审查后最多返回 3 位。搜索结果是人，不是回答。
5. **刘看山不是博主。** 刘看山及其知乎直达回退永远不得创建 `AuthorIdentity`、候选、关系或博主网络节点。
6. **重构运行时只使用真实数据。** 用户触发的回答、路线、知识生成、问博主和博主搜索必须经服务端调用 `.env` 配置的真实知乎与 LLM provider；缺少配置或 provider 失败必须返回明确错误，禁止降级为 mock、fixture、固定作者、预写回答或伪造成功。确定性 fake 只允许存在于隔离测试，明确标记的“示例”内容只能作为示例，不能冒充用户请求结果。

仍未裁决的只有：路径澄清题可见数量、冷域离页继续方式、博主网络的可视实体/边拓扑。它们在 ADR 与相关合同同改前只能保留 prototype，不得新增生产 schema 或写链。

## 3. Cursor 渐进式规则路由

Cursor 会自动读取根 `AGENTS.md`，并按 `.mdc` frontmatter 的 `globs` 自动附加匹配规则。下列重叠是有意设计：例如编辑 `Session.tsx` 时应同时加载知识生命周期、作者、可视化、前端和迁移/测试规则。

| 规则 | 自动匹配的关注点 |
| --- | --- |
| `.cursor/rules/00-architecture-core.mdc` | 任意 `src/apps/packages/server` 代码与工程配置：协议、投影、模块所有权、依赖方向 |
| `.cursor/rules/10-path-generation.mdc` | 路径规划、path-lab、路线列表、3D handoff、path contracts/server |
| `.cursor/rules/20-knowledge-lifecycle.mdc` | 概念进入、openLearning 导航、canonical 首答、conversation/history 重开门、selection、知识图与 GraphSurgeon |
| `.cursor/rules/30-authors.mdc` | 问博主、Chat/Session 问博主门、Authors 搜索/网络门、作者身份/evidence/network |
| `.cursor/rules/40-visualization-3d.mdc` | 图文 artifact、Chat/Session 图文门、Surface Catalog、知识画布、3D renderer/vendor |
| `.cursor/rules/50-frontend-runtime-ui.mdc` | React/TSX/CSS、RuntimeStore、页面、Chat 普通回答门、Chat 打开会话门、侧栏历史重开门、Settings identity/sources 门、Shell 账号身份门、Composer 附件/资料范围门、授权页 OAuth 门、可访问性和浏览器状态 |
| `.cursor/rules/60-backend-platform.mdc` | API/worker/server/contracts、provider、事务、事件、幂等、安全和可观测性；当前 `server/` live Zhihu/DeepSeek composition |
| `.cursor/rules/70-prototype-migration.mdc` | 当前 `src/` 原型、localStorage/fixture 清理和纵向迁移 |
| `.cursor/rules/80-testing-quality.mdc` | 源码、测试、配置和 catalog：TypeScript 风格、门禁、验证矩阵与 DoD |
| `.cursor/rules/90-docs-rules.mdc` | Markdown、AGENTS、`.cursor/rules`、架构证据和规则维护 |

若任务尚未引用具体文件（例如纯架构规划），先根据上表主动读取相关 `.mdc`，然后再给方案。不得只读本入口就开始重构。

## 4. 当前仓库事实

- 当前目录仍是 React/Vite UX 原型，主页面存在 fixture、页面内状态和浏览器存储；它不是生产架构。
- 运行时已不再借用兄弟项目 `node_modules` / `public` / `src`。图标、交互图引擎、3D 角色 GLB 与 3D 宿主合同摘录已落入本仓库 `vendor/`、`src/vendor/` 与 `public/assets/`。
- 服务端 `server/` 已从项目根 `.env` 读取知乎开放平台检索与 DeepSeek；缺配置时 `/ready` 失败。这只证明 live composition 骨架，不是 AnswerPipeline / PathStreamEvent / 作者网络 projector，不能标 `integrated`。
- 共享 runtime Zod 的唯一物理定义已在 `packages/contracts`。`../算法/shared/runtime-contracts.ts` 只保留兼容 re-export，删除条件见该文件与 `packages/contracts/COMPATIBILITY.md`。
- `@threadpeak/api-client` 与 `@threadpeak/runtime-store` 已提供 decoder / headless store。Home 与路线/知识列表开始走 selector；投影仍来自原型 `workspace/store`，不是服务端 committed GET。
- path-lab 的 JSON 实验请求已改走 api-client + RuntimeStore；它仍代理到本机 `4312`，不能证明主产品 PathStreamEvent/CAS session 已接通。
- 产品 Chat 路线模式已去掉页面 timer 和 `draftMineBlueprint` 成功路径；用户请求必须拿到已校验 document，否则显式失败。实验室 API 不可达或等待超时时不再停在 pending。仍不是 PathStreamEvent/CAS。
- 产品 Chat / Session 普通回答经同源 `/api/answers` 调用服务端知乎检索 + DeepSeek；缺配置或 provider 失败显式失败，不再用 `coachReply` 线性代数公式或 authors/visual sentinel 写知识图。仍不是 AnswerPipeline / committed artifact。
- 产品 `#chat` 不再在缺少发送上下文时预写「性价比高的显卡」或用 localStorage 正文冒充已打开会话；缺 launch 显式失败。Home 发送仍可写本地草稿 handoff。仍不是 owner-scoped conversation GET。
- 产品 Chat / Session 图文模式不再用页面 timer 和 fixture frames 冒充成功；没有真实 VisualizationArtifact 时显式失败。仍不是 Surface Catalog / committed visual attachment。
- 产品 `#path-3d` 对用户路线只渲染已校验 document；缺文档或示例 fixture 冒充用户路线时显式失败，不再回退 `threadPeakPathDocument`。示例路线仍用明确标记的示例文档。仍不是 CAS snapshot / wire-id handoff。
- 产品 `#session-learning` 在未选择 route/concept 时 fail-closed，不再默认 `linear-algebra` / `linear-map` 或发明首段讲解。进入时不再用 1800ms「正在准备」冒充生成。`openLearning` 不再用 `defaultConceptId` 补第一个概念。已选中的**我的路线**在没有 canonical 首答时显式失败，不再 `draftFirstLesson` 建图，也不再用 `growGraph`/`syncConversationGraph` 发明节点。`#knowledge-detail` 也不对 mine 做内存 `growGraph` 或 persist。workspace 读取也不会用 `draftFirstLesson` 改写 mine 的 lesson/图。已选中的示例路线仍可读标记 catalog lesson，不是 canonical 首答。
- 产品 Session / 划选问博主经 `/api/ask-author` 走 Zhihu-first；旧 storage 里的「马同学」不会再被渲染，失败批注不写入 sessionStorage。仍不是 committed AskAuthorResolution / 作者入网。
- 产品 `#authors` 博主搜索经 `/api/authors/search` 先查网络投影；投影未接通时显式失败，不会因此去知乎凑人。页面不再把未裁决的「载体→概念→问题」写成产品事实。仍不是 committed `AuthorSearchResult`。
- 产品 `#authors` 博主网络不再用 sessionStorage 或示例星图冒充已提交网络；没有真实 relationship projector 时显式失败，页面也不再 hydrate 入网。仍不是 owner-scoped network projection。
- 产品侧栏历史重开不再把 localStorage 会话正文当成已提交 history；没有真实 conversation GET 时显式失败，列表只标为本地草稿。仍不是 owner-scoped exact reopen。
- 产品 `#settings` 不再把写死用户或已上传 PDF 资料范围当成已提交 identity/sources；缺 provider 显式失败。密度、动效、思考深度仍是本地偏好。不得把原型登录态锁死整站。仍不是服务端 OAuth/session 或 committed source scope。
- 产品侧栏账号不再把写死姓名当成已提交身份；缺 provider 时只标本地原型账号，主题和退出仍可用。不得锁死整站登录。仍不是服务端 OAuth/session。
- 产品 Composer 不再把本地文件名或「已上传 PDF」资料范围当成已提交来源；缺 provider 显式失败。思考深度仍是本地偏好。仍不是 committed source/attachment scope。
- 产品授权页不再用 900ms「正在连接知乎」冒充 OAuth 成功；缺 provider 显式失败。进入本地原型仍可用，不得锁死整站登录。仍不是服务端 OAuth/session。
- 路径/知识算法实现与领域文档仍位于 `../算法/`，是实现/合同证据，不代表本 Web 已纵向接通。
- `prototype`、`contracted`、`implemented`、`integrated`、`production-ready` 必须按当前证据逐级判断；目录存在、类型检查、fixture 或历史测试数不能越级证明完成。

## 5. 每次任务的最小流程

1. 检查现场源码、当前文档和用户已有改动；不要从历史材料猜现状。
2. 根据目标文件加载所有匹配 `.mdc`；跨域修改必须同时满足各域规则和交接合同。
3. 先确定唯一 owner、事实源、状态机、事务/幂等边界，再实现 UI 或 adapter。
4. 使用匹配规则规定的验证矩阵；文档规则不能替代运行时、事务、浏览器或安全证据。
5. 只报告实际达到的成熟度。规则写入文件不等于代码已经实现。

## 6. 维护本规则体系

- Project Rule 必须使用 `.cursor/rules/*.mdc`；普通 `.md` 不会被 Cursor Project Rules 系统识别。
- 每条 `.mdc` 必须有合法 frontmatter，文件匹配规则使用 `alwaysApply: false` + 非空 `globs`；规则保持单一关注点并少于 500 行。
- 新增目录、模块或关键文件时，同一变更更新本路由表和相应 glob，避免出现没有领域规则覆盖的代码。
- 修改状态机/所有权时同步更新相关 `.mdc`、算法合同/ADR、检查清单与测试；禁止只改一个副本。
- 修改后至少验证 frontmatter、glob 代表性匹配、本地链接、规则行数、Markdown 围栏/表格和第 2 节不变量完整性。
