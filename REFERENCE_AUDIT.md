# 参考基线、当前实现与目标架构审计

本文件只记录参考证据、当前源码落点、已知债务和目标替换关系。它不是产品或架构权威；发生冲突时，以当前用户裁决、[`AGENTS.md`](AGENTS.md)、匹配的 [`.cursor/rules/`](.cursor/rules/) 和领域算法合同为准。

任何“页面存在”“视觉相似”“源码测试通过”都不能证明真实 API、持久化、并发、权限或恢复已经完成。参考项目的模块名和实现方式也不能直接变成 ThreadPeak 的领域合同。

## 审计标签

| 标签 | 含义 | 可以证明 | 不能证明 |
| --- | --- | --- | --- |
| `visual-reference` | 颜色、尺寸、层级或交互参考 | 视觉方向 | 数据和领域语义 |
| `prototype` | 当前 `src/` 中可运行的页面/fixture | 可见旅程草稿 | 生产后端或真实数据 |
| `migration-evidence` | 可复用 runtime、算法或 adapter 证据 | 某个局部模式可行 | 已纵向接通 |
| `target-contract` | AGENTS、规则与算法冻结的目标 | 重构必须满足的行为 | 当前已经实现 |
| `integrated` | Web→API→真实 provider→持久化/event→UI 通过 | 一条真实纵向链 | 全产品 production-ready |

## 当前原型与目标替换

| 当前源码落点 | 当前事实 | 重构目标 |
| --- | --- | --- |
| `src/components/Shell.tsx`、`src/styles.css` | 知乎浅色桌面壳、持久主侧栏和 Hash 页面 | Web shell 只组合 route、projection 和 feature UI |
| `src/components/Composer.tsx` | 路线、图文、问博主的输入外观与本地 UI state | 正向模式白名单；command 发往同源 API，未知持久化值归一为空 |
| `src/pages/Chat.tsx`、`src/chat/`、`src/workspace/catalog.ts` | 普通/图文无真实 provider 时显式失败，不再渲染预写 Mock 或 fixture 图；路线已改走 generate session | 真实 Answer/Path provider、typed stream、持久 request/session |
| `src/workspace/store.ts`、`src/history.ts`、`src/resolve-history-reopen.ts` | 侧栏重开不再把 localStorage 正文当成已提交 history；缺 provider 显式失败。workspace 存储仍是原型草稿 | owner-scoped 服务端事实、outbox/projector 和精确 history reopen |
| `src/pages/Session.tsx`、`src/session/`、`src/knowledge-canvas/`、`src/workspace/nav.ts` | 未选择时不再默认线性代数；我的路线不再 `draftFirstLesson`/`growGraph` 建图或画布 persist；问博主无真实 resolution 时显式失败；示例仍读标记 catalog lesson | canonical 初始回复 settle 后由 GraphSurgeon 创建并增量更新 |
| `src/session/ask-authors.ts`、`resolve-ask-author.ts` | 用户问博主不再渲染固定作者或预写回复；缺 provider 显式失败 | 真实知乎搜索、稳定身份、逐作者 evidence、LLM 候选内筛选 |
| `src/session/author-graph-rag.ts`、`resolve-author-search.ts`、`resolve-author-network.ts`、`author-network.ts` | 用户博主搜索与博主网络不再用本地 GraphRAG、sessionStorage 或示例星图冒充成功；缺 provider 显式失败。引擎仍隔离 | network-first AuthorSearch 与 committed relationship projector |
| `src/path-3d/`、`src/components/Path3D.tsx`、`src/vendor/learning-path-3d/` | 可运行 WebGL renderer；用户路线不再回退演示 fixture | 只消费已校验 path document 和服务端 handoff，不拥有学习事实 |
| `src/vendor/icons-v15.svg`、`vendor/charts/` | 图标与三类交互图已落入本仓库，不再读兄弟目录 | 仍是示例图文资产，不能冒充用户请求结果 |
| `packages/contracts` | 共享 Uuid/Evidence/Envelope/PublicError/StreamCursor 的唯一 Zod 定义；旧算法路径只 re-export | 路径/知识领域 schema 仍在算法包，本切片未接通 Web 写链 |
| `packages/api-client`、`packages/runtime-store`、`src/runtime/` | decoder 与 headless store 已落地；Home/列表页走 selector | 投影仍读原型 `workspace/store`；无产品 command 与真实 stream |
| `src/path-lab/path-lab-session.ts` | 实验台 JSON generate 经 api-client，页面只读 selector | 仍是 JSON 实验 API，不是 PathStreamEvent NDJSON / CAS restore |

## 视觉参考映射

### `zhihu_ux_ui/` → ThreadPeak

| 参考证据 | 当前源码落点 | ThreadPeak 适配边界 |
| --- | --- | --- |
| 1280×720 桌面框、220px 左栏、低对比内容面 | `src/components/Shell.tsx`、`src/styles.css` | 品牌为问山；导航为知识脉络、路线规划、博主网络 |
| 64px 收起侧栏、白色主内容面 | `Shell.tsx` + layout CSS | 产品页共享同一主侧栏；不恢复第二套集合侧栏 |
| 712×116 输入区、思考/附件/发送语法 | `src/components/Composer.tsx` | 模式只改变当前命令和提示；不在组件拥有领域状态 |
| `icons-v15.svg` 图标精灵 | `src/icons.tsx` + raw import + `IconSprite` | 精灵内联；本项目新增图标保持统一 24×24 keyline |
| 知识卡片和浅色标签语法 | `src/pages/Collections.tsx` | 路线与知识脉络共享视觉语法，但保持不同领域对象 |
| 遮罩、菜单、focus/disabled | Composer、确认框、知识边说明 | 必须继续满足 keyboard、焦点返回、ARIA 和 reduced motion |

### 旧 3D runtime → ThreadPeak

| 旧资产/行为 | 当前适配 | 目标约束 |
| --- | --- | --- |
| `LearningPathExperience` / WebGL runtime | `Path3D.tsx` 与本地 vendor artifact | vendor 只负责渲染，不生成路径、回答或知识图 |
| 绿色载体与旧概念层 | `src/pathDocument.ts` + vendor token | 载体绿、概念知乎蓝；颜色不改变语义 |
| 旧持久解锁/完成状态 | 当前使用内存 renderer state | 生产仍不保存学习进度；所有已发布节点可访问 |
| 旧卡片多操作 | 当前受控卡片与 CSS | renderer 只发已定义 interaction，handoff 由宿主校验 |
| GLB 与 bundle | `src/vendor/learning-path-3d/` | 只能通过受控同步重建，验证来源版本、digest、许可证和 public API |

### `thread-chatbot` 视觉语法 → 只读知识画布

| 参考语法 | 当前落点 | ThreadPeak 目标语义 |
| --- | --- | --- |
| 点阵、白色 Markdown 卡、左色条、曲线边 | `KnowledgeCanvas.tsx`、`styles.css` | 画布只读 committed snapshot/revision |
| 曲线分支序号 | SVG edge button | 序号和布局不能改变 semantic edge |
| 选中、缩放、复位、空白拖动 | 当前受控 view state | view 只发 interaction，不能创建、合并或删除领域节点 |

## 产品链路一致性

| 领域 | 冻结顺序/不变量 | 当前原型状态 |
| --- | --- | --- |
| 路线→概念 | 路线只生成 path；已校验 handoff 后才进入概念 | 尚未形成生产 handoff |
| 概念首次进入 | 先生成并 settle 唯一 canonical 初始回复，再创建 graph/root | 当前仍由本地 lesson/catalog 与页面写图模拟 |
| 再次进入/新对话/history | 永久复用 canonical；精确恢复，不重跑模型/projector | 侧栏重开已 fail-closed；浏览器存储只能证明交互草稿 |
| 后续回答→知识图 | 只有 settled answer 进入 GraphProjectionPipeline；GraphSurgeon 唯一写图 | 当前页面函数仍直接修改本地图 |
| 问博主 | 知乎站内搜索多个真实用户与内容→逐作者 evidence→LLM 选 1–2→0 才直达 | 当前固定数据必须删除出用户请求链 |
| 博主搜索 | 当前用户网络优先；有 1–3 位即停止；0 位才查知乎并由 LLM 选最多 3 位 | 用户搜索已 fail-closed；本地 GraphRAG 不得冒充成功 |
| 博主网络 | 只有最终回答采用真实作者后产生 committed relationship event | 用户网络页已 fail-closed；sessionStorage/示例星图不得冒充成功 |
| 刘看山 | 直达回答可以 settle，但不创建 AuthorIdentity 或网络节点 | 重构合同必须显式测试 |

## 真实 provider 与数据边界

服务端环境合同由 [`.env.example`](.env.example) 声明：

```text
ZHIHU_ACCESS_SECRET
ZHIHU_API_BASE_URL
DEEPSEEK_API_KEY
DEEPSEEK_BASE_URL
DEEPSEEK_MODEL_NAME
```

| 边界 | 必须满足 | 禁止 |
| --- | --- | --- |
| 配置读取 | composition root 启动时校验，生产使用等价 secret manager | domain/React 自行读 env |
| 浏览器 | 只访问同源 API/BFF | `VITE_*` key、`import.meta.env` provider 配置、内部 base URL |
| 用户请求 | 真实知乎与 DeepSeek adapter | mock、固定作者、预写回答、fixture fallback |
| Provider 失败 | typed error、可观测 stage、必要时保留上一份 committed data | 伪装 empty、切成本地成功结果 |
| 自动化测试 | fake 只在隔离 unit/contract composition | 用测试替身替代真实 live gate |
| 示例资产 | 明确标记、只读、与用户数据分区 | 进入证据、作者筛选、知识写入或用户请求结果 |
| 日志/错误 | 只记录安全 metadata、hash、长度、attempt | secret、token、原始 provider payload、用户正文 |

当前源码中的 catalog lesson/route、本地 GraphRAG 和浏览器事实源都是阻断 `integrated` 的迁移债务。它们可以暂时支撑视觉验收，但必须从用户请求的生产 composition 中删除。普通/图文/问博主/博主搜索/博主网络已从该 composition 去掉预写 Mock、固定作者、本地 GraphRAG 与 session 网络成功，改为显式失败，仍未接通 AnswerPipeline、VisualizationArtifact、AskAuthorResolution、AuthorSearchPipeline 或 author-network projector。

## 博主搜索与网络视觉锚点

| 可见合同 | 当前 UI 证据 | 目标数据语义 |
| --- | --- | --- |
| 搜索过程分阶段可见 | `#authors` 搜索表单与 fail-closed 提示；不再雷达扫出示例作者 | 先 network stage，零命中后才 Zhihu stage |
| 一位作者只出现一次 | 人物卡不得由本地 GraphRAG 或固定作者凑出 | 以稳定知乎外部用户 ID 去重，不按显示名合并 |
| 结果可解释 | 缺 provider 时 `role="alert"` | 显示来源、相关性、freshness 与真实内容链接 |
| 搜索与网络并列 | `Authors.tsx` 的两个板块，网络缺 projector 时 `role="alert"` | 搜索只读；候选、排名和点击不自动入网 |

当前白底、`#1772f6` 主蓝、`#edf4ff` 浅蓝状态面、`#e8eaed` 边界和 `#8590a6` 次级字继续作为视觉基线。其他参考只能提供“人是主体、关系可视”等设计启发，不能定义实体、边、权重或检索顺序。

## 像素验收锚点

| 项 | 目标值/视觉合同 |
| --- | --- |
| 视口 | 桌面基线 1280×720 |
| 主侧栏 | 展开 220px，收起 64px，背景 `#f4f6f9` |
| 主内容面 | 13px 外边距，13px 圆角，白底 |
| 首页输入区 | 最大宽 712px，高度至少 116px，13px 圆角 |
| 主操作 | 知乎蓝 `#1772f6` |
| 低对比边界 | `#e8eaed` / `#eceef1` 系列 |
| 3D | 载体绿、概念/道路知乎蓝；WebGL 失败有非 3D fallback |
| 知识画布 | 米白点阵、只读卡片、空白拖拽、分支边说明；布局不改语义 |
| 博主搜索/网络 | 白底、浅蓝状态、阶段明确；搜索输入不成为网络写入 |

## 当前未达到的完成条件

- 主产品尚无同源 API/BFF、真实知乎/DeepSeek composition 和 live-provider gate。
- 真实授权、作者身份归一、逐作者 evidence、知乎直达、provider failure 分类尚未集成。
- PostgreSQL/RLS、canonical unique constraint、conversation tree、outbox、worker、SSE replay 和 projector 尚无生产证据。
- path-lab 或 3D renderer 可运行不能证明回答、知识、作者和历史链路完成。
- 当前源码 regex、fixture 与构建只能证明原型结构，不能标记 `integrated` 或 `production-ready`。

每次更新本审计必须同时核对 `AGENTS.md`、匹配规则、README、实际源码和当次验证输出；不允许把目标架构写成当前完成态。
