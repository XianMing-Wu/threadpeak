# ThreadPeak Agent 入口

本文件是 `threadpeak-ux-ui/` 的**始终加载入口**。它只保留权威关系、不可违反的产品语义和渐进式规则路由；详细架构已经拆入 [`.cursor/rules/`](.cursor/rules/)，由 Cursor 根据正在查看或修改的文件自动附加。

不要为了省事一次性读取全部规则。先确定任务涉及的文件，再读取所有匹配规则；一个文件匹配多条规则时必须合并执行，不能任选其一。

## 1. 权威与适用范围

当前用户明确要求拥有最高权威。本文件与 `.cursor/rules/*.mdc` 共同约束本目录及其未来的 `apps/`、`packages/`、`server/`。

| 维度 | 权威来源 |
| --- | --- |
| 当前用户已裁决产品语义 | 本文件第 2 节；旧文档、fixture、截图和源码不得反向覆盖 |
| 领域字段、状态机、不变量、HTTP、持久化语义 | [`../算法/知识脉络/知识脉络图设计算法.md`](../算法/知识脉络/知识脉络图设计算法.md)、[`../算法/路径生成/最小学习路径算法部分.md`](../算法/路径生成/最小学习路径算法部分.md) 与 `../算法/shared/runtime-contracts.ts` |
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
| `.cursor/rules/20-knowledge-lifecycle.mdc` | 概念进入、canonical 首答、conversation/history、selection、知识图与 GraphSurgeon |
| `.cursor/rules/30-authors.mdc` | 问博主、博主搜索、作者身份/evidence/network |
| `.cursor/rules/40-visualization-3d.mdc` | 图文 artifact、Surface Catalog、知识画布、3D renderer/vendor |
| `.cursor/rules/50-frontend-runtime-ui.mdc` | React/TSX/CSS、RuntimeStore、页面、可访问性和浏览器状态 |
| `.cursor/rules/60-backend-platform.mdc` | API/worker/server/contracts、provider、事务、事件、幂等、安全和可观测性 |
| `.cursor/rules/70-prototype-migration.mdc` | 当前 `src/` 原型、localStorage/fixture 清理和纵向迁移 |
| `.cursor/rules/80-testing-quality.mdc` | 源码、测试、配置和 catalog：TypeScript 风格、门禁、验证矩阵与 DoD |
| `.cursor/rules/90-docs-rules.mdc` | Markdown、AGENTS、`.cursor/rules`、架构证据和规则维护 |

若任务尚未引用具体文件（例如纯架构规划），先根据上表主动读取相关 `.mdc`，然后再给方案。不得只读本入口就开始重构。

## 4. 当前仓库事实

- 当前目录仍是 React/Vite UX 原型，主页面存在 fixture、页面内状态和浏览器存储；它不是生产架构。
- 运行时已不再借用兄弟项目 `node_modules` / `public` / `src`。图标、交互图引擎、3D 角色 GLB 与 3D 宿主合同摘录已落入本仓库 `vendor/`、`src/vendor/` 与 `public/assets/`。
- 当前主产品尚未接通真实知乎/LLM provider；重构切片只有在真实服务端纵向链和 live gate 通过后才能标记 `integrated`。
- 相邻路径和知识算法包仍位于 `../算法/`，是实现/合同证据，不代表本 Web 已纵向接通；下一切片再迁入 `packages/contracts`。
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
