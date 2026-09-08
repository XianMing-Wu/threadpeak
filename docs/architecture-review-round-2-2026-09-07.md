# 第二轮架构审查修复（2026-09-07）

后续的共享 HTTP 限速、快照与事件原子性、离线备份入口及 PGlite 文件锁见[第三轮记录](architecture-review-round-3-2026-09-07.md)。下文保留第二轮当时的实现与证据，相关现状以第三轮及活动源码为准。

本轮接续[第一轮记录](architecture-review-fixes-2026-09-07.md)，以当前工作区和可执行回归重新核实。第一轮记录的测试结果是当时证据，不能证明这次指出的维护、代理和存储故障已被覆盖。未修改用户正在运行的验收容器、实际数据库或 provider 配置。

## 逐项裁决

| 二次审查项 | 判断 | 本轮处理与边界 |
| --- | --- | --- |
| maintain 失败使 claim 永远不执行 | 准确，是第一轮引入的回归 | 维护移到独立定时任务；启动先领取，60 秒后才维护。成功后一小时再执行，失败按 1/2/4/8/15 分钟退避；日志包含错误码、异常类型、下次间隔。领取循环不等待维护 |
| 大维护事务和逐行 UPDATE | 准确 | 每类清理最多 1000 行、压缩最多 100 个任务，使用 SKIP LOCKED；压缩合成一条批量 UPDATE。事务设 1 秒锁等待、5 秒单语句超时；有积压时一分钟后处理下一批。PGlite 底层仍串行执行 SQL，不能声称同一连接完全没有维护开销 |
| 代理 IP 导致全站共桶 | 准确 | Fastify 默认不信任任何转发头；部署显式信任独立代理网络中 Caddy 的 172.30.84.2/32。已认证业务请求按 owner 与规范化 IP 分桶；登录、公开入口和失败认证按 IP 分桶。登录在创建 session 前限流。非可信对端伪造 X-Forwarded-For 无法换桶 |
| localStorage 归档满额锁死账号切换 | 准确 | 先把旧账号的 local/session 草稿提交到 IndexedDB，成功后才清除旧键。恢复写不下时登录仍成功，缺失草稿保留在备份并显示导出入口。修复初次切换使 library 错判版本、以及 UI 投影缓存未随账号变化清除的问题 |
| 即使备份失败也必须无条件清除旧键 | 不采用无条件清除 | 如果 IndexedDB 和 localStorage 两处都不可写，无法同时保证持久保存唯一草稿并清除它。此时保留原字节及旧所有权边界，给出明确错误和可用的完整导出入口；不以丢失草稿换取切换成功。这与单独 localStorage 满额已可正常切换的路径不同 |
| stop 后必须等待 90 秒接管 | 准确 | 新增 release：同 job/fence 且 running 才交回 queued，同时提高 fence、清零租约与等待时间。保留检查点、草稿和所有重试预算；不会复活已取消或完成任务。处理 stop 期间刚返回的 claim；取消心跳，最多等待忽略 abort 的 handler 10 秒 |
| 用 recover(SHUTDOWN) 交接 | 不直接采用 | 正常停机会被记成一次失败并产生重试退避。单独 release 保留失败预算，实际数据库无法访问时仍需依靠崩溃租约恢复，不能承诺失联也能立即交接 |
| knowledge/lessons 访问器仍像当前权威 | 准确 | 旧查询更名为 getReadOnlyKnowledge、getReadOnlyKnowledgeByRoute、getReadOnlyConceptGraph、getReadOnlyLesson、listReadOnlyConceptCards；只服务归档或命名示例。删除死的 hasSettledMineConcept、openKnowledgeFromSession、伪同步和生成状态门面；library 投影只暴露 exampleKnowledge，当前“我的知识”使用服务端 ProductLibrary |
| showcase 固定 ID 的非空断言会崩溃 | 准确 | 推荐概念改名时回退到该示例的首个概念，空集合不产生推荐项。测试覆盖改名与空集合 |
| 恢复额度使用累计次数而非窗口次数 | 准确 | 新增 tp_job_resumes，每次成功恢复在同一事务记录时间和序号；窗口内 COUNT(*)，不再 SUM(lifetime count)。历史库只迁入最后一次已知时间，旧系统未记录的较早恢复时间不能事后重建；新记录窗口精确 |
| tp_jobs 行数仍随命令增长 | 准确，但不采用直接 TTL 删除回执 | 三十天后压缩输入与检查点，保留最小幂等回执。相同旧命令仍返回原 job，变更输入仍拒绝。直接删掉唯一回执会允许迟到重放重新扣费；把同样回执搬到另一张表也不能解决总存储增长。完整账号删除/备份保留政策仍是上线门槛，本次不冒充已完成无限历史有界存储 |
| /events 与 EVENT_GAP 没有前端消费者 | 准确 | 删除未接入的公共 events HTTP 路由；客户端继续使用有界快照轮询。内部 store.events 保留用于诊断与持久性测试，EVENT_GAP 不再被描述为已经接入浏览器的能力 |
| 每秒六次全图 JSON.stringify | 部分准确 | after revision 已让未变化轮询直接返回 unchanged；但草稿更新仍触发比较。新增服务端 dataRevision，草稿/活动变化复用已有正文对象；真实内容变化才逐值比较，不再构造完整 JSON 字符串 |
| 大 chunk 都超过 500 KB | 数值需修正 | 440.64 KB 的 MarkdownMath 和 363.86 KB 的 path-3d-stage 没有超过 500 KB。704.11 KB 的 CharacterRig 仍超限且按需加载；不修改受清单保护的 vendor 生成物或抬高阈值隐藏警告 |
| 停止消息 ID 重复拼接 | 准确 | 统一 stoppedMessageId，取消和恢复使用相同构造 |
| commit 持锁时执行 evidence 回调 | 观察准确，不能移出原子提交 | 作者 evidence 改为一条批量 INSERT，消除逐行网络往返；正文、卡片与作者证据仍同事务提交。移出事务会重新引入半提交。其他状态检查需要在持锁后读取最新资源 |
| 排队超时 180 秒就永久终止 | 需要修正 | 不自动重排，防止饱和时放大；状态是 waiting，内容保留，预算未耗尽时可由用户手动恢复。未改变这项边界 |
| 空旧目录、覆盖缺口 | 准确 | 删除列出的空目录；补关键故障和账号 UI 缓存测试。仍不宣称画布编辑、作者全部交互或移动端已全面覆盖 |

## 关键实现与回归

- [worker](../server/durable/worker.ts)、[store](../server/durable/store.ts)、[database](../server/durable/database.ts)：维护、交接、配额、正文版本；[生命周期回归](../server/durable/worker-lifecycle.test.mjs)使用可控时钟和握手覆盖持续失败、阻塞维护、停机途中领取和忽略 abort 的 handler。
- [HTTP](../server/durable/http.ts)、[Compose](../compose.yaml)、[身份/代理行为测试](../tests/product-invariants.test.mjs)：真实 Fastify inject + 生产身份验证；同代理不同 IP、同 IP 不同 owner、伪造转发头、登录创建 session 前限流。
- [账号存储](../src/learning-v2/account-storage.ts)、[存储测试](../tests/ui/account-storage.test.tsx)：独立持久备份、容量不足恢复、两处存储失败、导出和 library 首次读取；[UI 组合测试](../tests/ui/runtime.test.tsx)验证账号变化后投影清除。
- [PostgreSQL gate](../server/durable/postgres.gate.mjs)：隔离 threadpeak_test 库，真实连接/进程；即时交接、检查点、迟到提交、压缩和旧幂等命令复用。

[浏览器回归页](../qa/account-storage-review.html)必须使用独立 localhost 源；检测已有数据/备份时拒绝运行。实际浏览器写入 79 块合成数据，触发真实 QuotaExceededError，归档 5,177,357 个字符后完成账号隔离与完整草稿恢复。没有用模拟 Storage 错误替代这次浏览器实测。

## 验证记录与未覆盖边界

本轮通过：类型检查、lint、构建、366 项 Node 测试、14 项前端测试、4 项真实 PostgreSQL gate；前端行覆盖 713/3222（22.12%），入口包 375.23 KB。具体命令结果、覆盖率分母与浏览器数据见 [validation.json](../qa/architecture-review-round-2-2026-09-07/validation.json)。自动测试在 provider 边界使用明确的离线替身；没有请求新的收费模型结果，也没有部署生产服务。

覆盖报告原先经过 source map 重映射混入 contracts 代码。本轮增加重映射后的排除，前端分母只包括 src（排除 vendor 和测试文件），不与上一轮混合口径的百分比直接比较；服务端 Node 覆盖仍只代表被执行加载的 TS 文件，不能当全仓库覆盖。

保留的上线边界：真实身份提供方联调、实际域名 TLS/代理拓扑、目标并发量压测、真实模型语义质量与费用、完整账号及备份删除政策。request 限速为每 API 实例的桶；任务配额和 provider 两路额度由 PostgreSQL 跨副本共享。机器或数据库不可达时不能保证立即交接；外部服务忽略取消或崩溃重试仍可能产生重复费用。

代理配置依据：[Fastify trustProxy](https://fastify.dev/docs/latest/Reference/Server/#trustproxy)、[Caddy reverse_proxy 转发头](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy#headers)。Caddy 默认不信任客户端提交的转发头；若实际增加 CDN 或身份代理，必须重新配置并验证整条可信代理链，不能直接设置 trustProxy=true。
