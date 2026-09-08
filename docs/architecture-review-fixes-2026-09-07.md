# 2026-09-07 架构审查复核与修复

后续复核发现本轮新增的维护调度、代理限速、账号备份和停机交接缺陷；最新修复与验证见[第二轮记录](architecture-review-round-2-2026-09-07.md)。下文保留第一轮当时的判断和证据。


本记录针对用户提交的七组架构发现及八项处理建议。修复在当前 checkout 中完成；产品裁决以 [现状与目标](../as-implemented-logic.md) 和 [Agent 合同](../agent-specs.md) 为准。没有重新设计 Agent 提示词、加入 judge、改写 3D vendor 生成物或部署到生产。本文中的测试数字是本次执行记录，不是永久成熟度声明。

## 1. 复核结论与处理

| 原审查项 | 判断 | 本轮处理与证据位置 |
| --- | --- | --- |
| 旧知识入口调用缺失 API，404 删除本地图 | 准确，必须优先修复 | [只读归档入口](../src/knowledge-canvas/mine-graph-canvas.tsx) 不发旧 HTTP 请求、不写图、不删除。部分旧图也可读取；旧原始字节保留、可导出。实际组件回归断言没有 fetch/setItem |
| 两套服务端组合根、旧 orchestrator 并存 | 准确；删除需看实际依赖 | 删除 server/http、旧 first-learning/follow-up/authors/ordinary-chat/identity、旧 path-generation orchestrator/http/pack-search、旧 invoke/prepare/compress 等；保留活动的 goal-exploration/project-document/staged-plan、provider 适配器、schema 与卡片工具 |
| 两套前端学习、普通回答、作者栈 | 准确 | Session 只按明确示例/真实路线进入当前 Workspace；删除 Legacy SessionLearning、旧 KnowledgeCanvas、pages/Authors、不可达 OrdinaryAnswerLive、旧学习/作者/普通回答请求器。示例仍显式标识 |
| 浏览器本地知识图引擎与伪造正文 | 准确 | 删除 syncConversationGraph、replayConceptGraph、mockTurn 和 generate.ts。已生成内容、段落与单父树由服务端拥有；浏览器不再重放对话编图 |
| hydrate 丢字段、陈旧本地字段覆盖服务端 | 准确 | [投影写入](../src/workspace/store.ts) 以服务端标题、目标和结构为准，仅保留明确草稿字段以及已知的对话/知识关联、过程展示记录；不把 example 写成 mine |
| 每次读都解析/迁移写、损坏 JSON 被空快照覆盖 | 准确 | [snapshot-cache](../src/workspace/snapshot-cache.ts) 按原字符串缓存并验证元素；读取无写操作；旧键永不覆盖。新投影损坏时先保存原字节，备份失败就拒绝覆盖；界面提供恢复提示和导出 |
| 两套前缀导致切换账号残留 | 准确 | [account-storage](../src/learning-v2/account-storage.ts) 同时处理 tp-/threadpeak-，按账号归档草稿/旧内容，只恢复对应账号，跨账号迟到响应被拒绝；主题偏好独立保留 |
| PGlite 嵌套事务未使用当前连接 | 准确；PostgreSQL 也需要修正 | [database](../server/durable/database.ts) 的 PGlite 使用同连接 SAVEPOINT，postgres.js 嵌套调用 savepoint；串行化同层嵌套操作，避免一个兄弟回滚另一个兄弟。两种驱动运行相同的嵌套回滚合同 |
| 超过 30 秒的 LLM 必然丢租约 | 需要修正 | 原代码有独立 5 秒心跳，模型 await 不会阻塞心跳。确有过期后无法续租的竞争：租约改 90 秒，无新 fence 时允许同持有者续租，新持有者已接管则拒绝旧续租和提交。不能承诺外部调用 exactly-once |
| claim 消耗失败预算 | 准确 | claim 只领取并推进 fence；recover 按实际失败计数，最多四次失败。接管本身不消耗错误次数；测试覆盖反复接管后失败预算仍完整 |
| 网络/超时/瞬时数据库错误不可重试 | 准确 | [worker](../server/durable/worker.ts) 对 fetch 网络异常、TimeoutError/AbortError、明确连接/事务冲突错误分类；程序 TypeError 不一律重试；显式取消也不重试 |
| draft 事件完整复制、事件和任务持续膨胀 | 准确 | progress 事件只存轻量通知，当前 draft 存任务行；事件保留七天。完成任务三十天后压缩重复输入/检查点，保留已发布资源、状态和幂等收据。旧游标返回 EVENT_GAP，必须重新 GET；不能直接删收据导致旧命令再次收费 |
| 热路径缺索引与全历史配额聚合 | 准确 | 新增 resource_id + created_at DESC + id DESC、owner + recent、owner + active、owner + resumed_at 索引；配额拆成有界时间/状态的索引查询，恢复也进入账号额度 |
| permit 轮询重复 seed、排队超时自动放大 | 准确 | [limits](../server/durable/limits.ts) 常规池一次批量 seed；按已知冷却/启动时间等待，其余等待逐步退避；排队超时不自动重排。临时 cache 槽保留空闲行，避免释放时删除与等待者竞争，维护再清理 |
| 60 秒许可泄漏没有回收器 | 部分准确 | 原领取查询已可回收过期租约，并非永久泄漏。现采用 30 秒许可/5 秒心跳，验证崩溃持有者过期可重新取得；崩溃期间存在有限吞吐下降，分布式租约无法宣称零停顿 |
| 2100ms 发送间隔违反两路并发 | 需要修正 | 同时在途数与请求启动速率是两个限制；已有用户裁决和官方限流适配明确保留两者。未取消间隔，改用可控时钟/握手测试验证两路在途与第三路排队 |
| PGlite 不能跨进程共享名额 | 准确的边界 | PGlite 目录增加进程所有权文件，拒绝同目录多个持有者。生产原已强制 PostgreSQL；现在文档明确“同 PostgreSQL 跨副本共享”，并有三个独立 Node 进程组合验证 |
| cache → zhihu 锁顺序仅靠注释 | 准确 | AsyncLocalStorage 记录嵌套池，反向/重复取得立即明确失败，正常 cache 先于 provider 的顺序有行为回归 |
| 取消不立即停止开销 | 部分准确 | 同进程取消提交后立刻通知运行任务的 AbortController；跨进程仍最多等待下一次约 5 秒心跳。取消先赢时拒绝迟到答案是正确行为，未把完整迟到结果偷偷发布；保留已经流出的草稿 |
| resume 无限重试、清空检查点 | 准确 | 每任务最多四次显式恢复、至少 30 秒间隔、共用账号额度；等待/取消从已有检查点继续。完成的普通任务不重跑；明确重搜空结果时将之前所有检查点归档再搜索，同样受预算约束；三十天压缩归档后不可重启 |
| 源码字符串测试无法证明产品行为 | 准确 | product-invariants 改为真实 HTTP 身份/权限/安全行为和树约束；contracts 改为公开包边界及载荷解析；runtime 改为退避/取消/快照应用。文档拼写只留在 check:docs，名称和 README 明确其证明范围 |
| 默认测试含大量不可执行服务的测试 | 准确 | 同步删除只测试已删除模块的文件；保留并加强 durable 活动管线测试。default test 增加 jsdom 实际组件 → productRequest → Fastify inject → worker → store，替身只在模型/知乎 provider 边界 |
| 生产身份未组合测试 | 准确 | [产品行为测试](../tests/product-invariants.test.mjs) 使用 production:true，验证签名、篡改/过期、HttpOnly/Secure/SameSite Cookie、CSRF、跨账号 404、退出。属于离线生产模式合同；真实签发方/OAuth 接入仍须验收 |
| 无 lint/coverage 与短时间断言易抖动 | 准确 | 添加 ESLint 错误规则与 hooks rules-of-hooks；加入 Node/V8 与前端全文件覆盖率。共享调度器以可控时钟和同步握手断言；任务等待改用 30 秒测试期限，不以 400×10ms 假定 CI 速度 |
| contracts 公开入口绕过与 ProductLibrary any[] | 准确 | package.json 明确每个公开子路径；所有外部消费者改用 @threadpeak/contracts 子路径。相对路径深引和未导出路径都拒绝；[ProductLibrarySchema](../packages/contracts/src/product-library.ts) 在服务端响应和客户端投影两端校验 |
| runtime-store 原语未用于服务端事件 | 准确；无需伪装接通 | 当前产品使用修订号快照轮询，未声称套用 applyCommittedEvent；selector 实例改名 library-projection-store，按订阅数注册和拆除监听器。包中的事件原语保留为独立、已测试工具，并非产品事件传输 |
| 多套轮询、无限错误重试 | 准确 | [pollResource](../src/learning-v2/poll.ts) 统一默认一秒轮询，错误指数退避、最多连续六次，401/403/404 停止，支持取消并明确重连动作；不取消后台任务 |
| render 推进 revision、修改 parse 后对象 | 准确 | 接收服务端响应时推进 ref，渲染阶段不推进 revision；[mergeLearningSnapshot](../src/learning-v2/snapshot.ts) 用新对象保留共享数组，不改 schema 返回对象，拒绝低 revision |
| 卸载后异步 setState、不可达 effect 依赖 | 准确 | 旧 follow-up 整体下线，当前命令/保存/路线恢复回调检查挂载和请求所有权；旧 Chat effect 随不可达代码删除。另修复 StrictMode 重挂载误报“已停止”，实际浏览器及组件回归均验证 |
| 历史一行两个目的地 | 准确 | Shell 只展示服务端历史；旧本地记录放显式归档。路线首次接受和状态切换刷新 library，失败任务也能从历史回到原任务 |
| Home/path-run-client JSON.parse 不保护 | 准确 | launchChat 直接返回 ID；被冻结的发送记录、范围采用 try/catch + schema，损坏时保留原字节并明确失败 |
| path-3d-stage 的 JSON.parse 危险 | 需要修正 | 该值是同一次计算中 JSON.stringify 产生的内部键，不是任意存储/网络输入；没有为了“无 JSON.parse”而改动此处 |
| 缺安全响应头/速率限制 | 准确 | Fastify Helmet 与进程内 IP 限速；账号任务额度由数据库跨副本实施；默认 body 1 MB，仅附件与卡片编辑路由 20 MB。鉴权在解析正文前执行 |
| 没有 CORS 插件就是安全漏洞 | 需要修正 | 当前同源部署依赖 Cookie、Origin/sec-fetch-site 校验，不开启跨源凭据访问；加入通配 CORS 反而扩大访问面，未添加 |
| Coverflow 无来源、版本或许可证 | 需要修正 | 原已有 src/vendor/coverflow/SOURCE.md、上游 commit 与 MIT LICENSE。中央 [vendor 索引](../vendor/SOURCE.md) 现在补充入口与保留本地适配的更新流程 |
| generate.ts 的未申报改编来源 | 准确且已移除 | 整个旧图引擎删除，不继续复制或补造许可证；只保留显式示例的数据与当前渲染组件 |
| 主 bundle 过大、路由一行九分支、GLB 重复 | 准确 | App 使用路由映射和 lazy/Suspense，3D 二级按需加载。删除四份 public/assets 重复 GLB，宿主继续使用 Vite 处理的 vendor 资产 URL，3D artifact 不变 |
| 过期文档与散落兼容备忘 | 准确 | 十份源码目录兼容备忘和第二轮确认题移至 docs/archive/compatibility；qa/architecture-status 改为当前索引；README、REFERENCE_AUDIT、两份权威文档、相关规则和部署手册同步 |

## 2. 数据与恢复策略的具体范围

旧 `threadpeak-workspace-v1` 仅作为本账号归档读取，不被 hydrate/读取迁移覆盖。当前 `threadpeak-projection-v2` 保存服务器 GET 的投影和未提交草稿；清空投影后仍可以重新获取正式路线、知识树和聊天。旧资料不会自动“转换”为新的服务端知识；归档保留原关系和正文，不以模型或示例补足来源。损坏字节先备份，用户可导出。

生产资源正文、原文章、作者证据和已提交聊天不进入七天事件清理。三十天任务压缩不删除幂等键和原始请求摘要；重复提交相同旧命令仍返回同一收据，改变输入仍报冲突。等待/取消任务保留恢复所需数据，因此这不是完整的账户删除、备份淘汰或无限增长解决方案。正式用户删除政策仍是上线决策。

运行任务与外部请求分别有租约。90 秒任务租约降低瞬时停顿导致误接管的概率，fence 决定提交资格；provider 许可保证同库在途额度。长时间停机、网络分区或外部服务忽略 AbortSignal 时，不能保证费用恰好一次。将租约改得无限长会损害崩溃恢复，未采用。

## 3. 本轮验证记录

- Node 行为/合同/文档测试、前端真实组件组合测试、TypeScript 产品和测试配置、ESLint、生产构建分别执行。本次最终结果为 358 项 Node 测试、7 项组件组合测试、3 项 PostgreSQL gate 全部通过；产品及测试配置的 TypeScript、ESLint 与生产构建通过。机器可读记录见 [validation.json](../qa/architecture-review-2026-09-07/validation.json)。
- PostgreSQL gate 使用独立 `threadpeak_test` 库和三个独立 Node 进程；不连接现有用户验收库。覆盖并发迁移、12 次重复命令单次接受、租约接管、旧 fence 拒绝、事务回滚、重连、同层/嵌套 savepoint 和跨进程两路许可。
- 浏览器使用独立 PGlite 目录及隔离端口，未加载真实 provider 配置。验证首页、路线失败保留、刷新恢复、服务端历史、示例 3D 场景/资产/键盘选择/角色移动、概念进入学习以及研究切换八节点知识树，所查页面未记录 console error；此项证明交互与失败边界，不证明模型内容质量。
- 普通聊天组合测试确实走 createFlows/ProductTools/R5、真实 worker 与提交事务，由 provider 边界返回明确的离线响应；新对话组合测试同时断言文章、树和归档对话保留。
- TypeScript AST 传递导入盘点（含类型导入）：server 共 49 个 TS 文件，main 闭包覆盖 48 个；仅 ops.ts 不由 main 引入，它是 package.json 的独立 ops:queue 命令。未以保留测试作为第二产品组合根的理由。
- 3D 生成物按清单逐文件 SHA-256 比较；删除的是 public 下与 vendor 相同的重复文件。Coverflow 源码与其本地来源记录均保留。

本次主入口 375.40 KB（gzip 135.43 KB），对照用户审查中的旧值 1781.87 KB；另有按需 chunk，不能将该数字解释为整个站点总下载量。

本次 Node 已加载 TS 的行/分支/函数覆盖率为 91.55% / 82.35% / 89.05%；前端全源码为行 732/3892（18.8%）、分支 12.86%、函数 14.32%。覆盖率分母必须区分：Node 原生报告只统计被加载的匹配 TS 文件；前端 V8 报告包含 src 下全部 TS/TSX（排除 vendor 和测试）。前者不能代表全部前端，也不能用一个高百分比掩盖未执行的画布编辑和响应式交互。HTML 报告生成于 `coverage/frontend/index.html`，不提交生成目录。

## 4. 仍需独立验收的上线条件

本次没有发布生产，没有验证真实 OAuth 应用、身份签发方、域名/TLS、目标并发负载、真实 provider 成本或长材料压缩保真。已有历史真实 provider 证据仍只证明当时样本；本次移除旧管线、修复恢复与边界不扩大这些证据的适用范围。

3D 的 CharacterRig vendor chunk 仍超过 500 KB，但不进入首页入口包；需要进一步压缩时应在上游构建并完整同步，不能手改生成物。前端全量覆盖率仍较低，应继续补画布编辑、作者交互和移动端行为；本轮关键数据损坏/接口断链已有实际组合覆盖，不宣称所有 UI 都验收完毕。

参考适配器语义：[PGlite API](https://pglite.dev/docs/api)、[postgres.js transactions/savepoint](https://github.com/porsager/postgres)、[Fastify rate limit](https://github.com/fastify/fastify-rate-limit/blob/main/README.md)。仓库现场与本轮命令结果是实现证据，外部文档不替代本地验证。
