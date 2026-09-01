# ThreadPeak UX/UI

`threadpeak-ux-ui` 当前是 React + Vite UX 原型，用于核对页面、交互、3D 宿主和迁移切片；它不是生产架构，也没有因为页面可运行或源码测试通过而自动接通后端。

产品与工程约束以 [`AGENTS.md`](AGENTS.md) 和匹配的 [`.cursor/rules/`](.cursor/rules/) 为准。跨进程 runtime Zod 的唯一物理定义是 [`packages/contracts`](packages/contracts/src/runtime-contracts.ts)。浏览器 transport 与 headless store 分别是 [`packages/api-client`](packages/api-client/src/index.ts) 与 [`packages/runtime-store`](packages/runtime-store/src/index.ts)；路径/知识领域文档仍位于 `../算法/知识脉络/` 与 `../算法/路径生成/`。参考项目、截图、旧 Demo 与本文件只能提供证据，不能覆盖当前用户裁决或领域合同。

## 已冻结的产品链路

### 路线、概念学习与知识脉络

```text
真实目标输入 → 路径生成与校验 → 发布路线 → 已校验 handoff
  → 第一次进入概念 → 生成并 settle 唯一 canonical 初始回复
  → 创建 KnowledgeGraph 与唯一根节点 → 页面 ready
```

- 路线生成、路线列表、3D 预加载都不能创建知识脉络。
- 同一用户、路线实例和概念只有一个 canonical 初始回复。再次进入、新建对话、历史恢复、图谱修复或模型升级都只能复用，不能重写。
- 后续已 settle 回答可以触发知识图增量投影；页面、3D、作者模块和前端组件都不能直接写知识图。
- History 精确恢复已提交 conversation，不重新调用模型、重新筛选作者或重建知识图。

### 问博主

```text
知乎站内搜索多个真实用户及其回答/内容
  → 稳定身份归一 → 逐作者 evidence pack
  → LLM 只在候选中筛选 1–2 位
  → 0 位可信作者时由刘看山调用知乎直达
```

刘看山直达结果可以成为回答，但刘看山不创建作者身份，也不进入博主网络。

### 博主搜索与博主网络

博主搜索固定为 network-first：

```text
先查当前用户博主网络
  → 有相关作者：最多返回 3 位并结束
  → 0 位相关作者：再查知乎 → LLM 审查 → 最多返回 3 位
```

搜索结果是人物卡，不是回答；不足 3 位不补齐。候选、排名、展示和点击都不会自动写入博主网络，只有已提交的真实作者关系事件可以更新网络。

## 真实数据与环境配置

重构后的用户请求运行时必须调用真实知乎与真实 LLM provider，不能使用 mock、fixture、固定作者或预写回答伪装成功。

项目根 [`.env.example`](.env.example) 声明以下服务端变量，真实值只保存在未提交的 `.env`：

```text
ZHIHU_ACCESS_SECRET
ZHIHU_API_BASE_URL
DEEPSEEK_API_KEY
DEEPSEEK_BASE_URL
DEEPSEEK_MODEL_NAME
```

- `.env` 只由服务端 composition root 读取；React、Vite bundle 和浏览器不得读取、记录或回传这些变量。
- 禁止把密钥改成 `VITE_*`，也禁止在前端使用 `import.meta.env` 访问 provider 配置。
- 必需配置缺失、为空、鉴权失败、超时、限流或响应无效时必须显式失败，不能切换到本地假数据。
- mock/fake/stub 只允许用于隔离的 unit/contract 测试，不能进入生产依赖图或替代真实 provider live gate。
- “示例路线”和“示例知识脉络”可以保留为明确标记的只读示例资产，但不能成为用户请求结果、证据或知识写入来源。
- 永远不要在日志、截图、测试输出、README、错误响应或提交记录中展示 `.env` 的值。

## 当前可见原型

运行：

```bash
npm run dev
```

打开 `http://127.0.0.1:4301/`。当前页面是迁移输入，不代表对应后端能力已完成：

| 入口 | 当前原型职责 | 目标重构边界 |
| --- | --- | --- |
| 初始授权态 | 知乎授权视觉入口 | 服务端 OAuth/session，密钥与 token 不进浏览器 |
| `#home` | 路线/图文入口、Composer、示例推荐 | command/query 进入同源 API，不在页面生成领域事实 |
| `#chat` | 普通/图文无真实 provider 时显式失败，不再渲染预写 Mock 或 fixture 图；路线模式走 generate session，失败显式报错 | 普通回答接 AnswerPipeline；路线接 PathStreamEvent/CAS，图文接真实 visual artifact |
| `#paths` | 我的路线/示例路线列表 | 读取 committed path projection |
| `#path-3d` | WebGL renderer；用户路线缺校验文档则显式失败，不再回退演示路径 | 只消费已校验 document 与 server handoff，不保存学习进度 |
| `#knowledge` | 我的/示例知识脉络列表 | 读取 owner-scoped committed projection |
| `#knowledge-detail` | 只读知识画布；我的路线不得内存 `growGraph` 或 persist | 只渲染 revision，不从消息或布局发明节点和边 |
| `#session-learning` | 未选择 route/concept 时显式失败；我的路线不发明 lesson/图/conversation 节点；图文/问博主无真实 provider 时显式失败；示例仍用标记 catalog lesson | 严格执行 canonical 首答在前、知识图在后 |
| `#authors` | 博主搜索无真实 provider 时显式失败，不再用本地 GraphRAG 或示例作者雷达冒充成功；博主网络仍是视觉原型 | 搜索与网络为两个 feature，执行不同检索顺序和写入规则 |
| `#settings` | 前端偏好与确认界面 | 偏好不能改变领域合同 |

## 独立路径算法实验台

`path-lab.html` 是隔离的算法/renderer 验证入口，不属于主产品壳：

```text
http://127.0.0.1:4301/path-lab.html
```

它经 `@threadpeak/api-client` 调用 `POST /api/paths/generate`，由 RuntimeStore 保存已发布 document；只把通过校验的 `renderer_document` 交给 3D renderer。前端与图表/3D 资产已在本仓库内构建；实验 API 仍可能指向本机 `127.0.0.1:4312`，不能证明主产品的回答、知识、作者或历史链路已经接通。目标生产 workspace 必须使用本项目服务端 adapter、真实 provider、持久化合同和可复现构建。

## 当前验证

```bash
npm run check
npm run check:architecture
npm run check:contracts
npm run check:product-invariants
npm test
npm run build
```

- `check`：当前 TypeScript 工程检查。
- `check:architecture`：解析本仓库 import graph，阻断兄弟目录与出仓路径。
- `check:contracts`：共享 runtime/transport schema 的 golden fixture、api-client decoder，以及旧算法路径 re-export 双边一致。
- `check:product-invariants`：验证渐进式规则元数据、规则路由、六条冻结语义、三份文档一致性和服务端环境合同。
- `test`：当前页面与源码合同；其中大量 regex/fixture 只能证明原型结构，不能证明真实网络、事务、权限或恢复。
- `build`：使用本仓库 lockfile 与本地 vendor 资产构建；不再读取兄弟项目 `node_modules`。
- `../threadpeak-state-machines/npm run validate`：状态机文档验证，不能替代运行时集成测试。

重构切片只有同时通过同源 Web→API→真实 provider→持久化/event→UI 的纵向验证，以及真实知乎/DeepSeek live gate，才能标记为 `integrated`。规则文件或 README 写明目标不等于实现完成。

## 当前明确未完成

- 主产品仍包含本地 catalog、预写回答、固定作者数据、页面 timer 和浏览器存储，尚不满足真实数据门禁。RuntimeStore 目前只投影原型列表，不是服务端 read model。
- 知乎授权、真实回答/作者检索、LLM 生成、PostgreSQL、worker、outbox、SSE/projector 和 owner 隔离尚未纵向接通。
- 首答永久性、并发 singleflight、graph bootstrap/incremental、作者网络事件和精确历史恢复尚无生产数据库证据。
- 3D 当前只证明 renderer 交互；不能据此声称路线生成、概念进入或知识生命周期已完成。
- 桌面基线为 1280×720；当前版本不声称完成移动端或生产安全验收。

视觉参考、源码落点、当前债务和目标替换关系见 [`REFERENCE_AUDIT.md`](REFERENCE_AUDIT.md)，页面与旅程机读目录位于 `catalog/`。
