# 第三轮架构审查复核与修复（2026-09-07）

本轮继续以活动工作区和实际执行为准。复核第三轮报告后，修复共享 HTTP 限速、快照读取、事件版本约束、备份恢复提示和 PGlite 目录锁五处。没有改 Agent 提示词、收费 provider 配置、在用验收容器或用户数据库，没有部署到生产。

## 逐项裁决

| 第三轮审查项 | 判断 | 本轮结果 |
| --- | --- | --- |
| HTTP 限速为每实例内存桶 | 准确 | 改用数据库原子计数，多副本和进程重启共用窗口；真实 PostgreSQL 双连接、两个 HTTP 实例及重新创建的第三实例验证同一预算 |
| snapshot 读取使用 FOR UPDATE | 准确 | 单条不加锁的 MVCC 查询同时取得资源和最新任务；持有写锁期间能读取上一完整提交，写入提交后再读到完整新状态 |
| event 的版本依赖调用方先锁行 | 准确 | 旧版本比较、数据库自增和事件插入放在同一 SQL；省略外部行锁也只能成功一次，冲突返回类型化错误 |
| equalJson 会因深知识树而栈溢出 | 当前触发条件不成立 | 当前 NodeSchema 是扁平数组元素，parents 是 ID 字符串；文章、消息、活动合同也没有递归 JSON。树高增加数组长度，不增加比较栈深，保留现实现 |
| 恢复提示刷新后丢失 | 部分准确 | pending 元数据原本已持久化，且 ensureSession 会重新加载；缺口是离线时的发现和 UI 订阅。现在独立读取 IndexedDB，知识/路线页及离线登录页均可发现、导出 |
| PGlite PID 复用拒绝启动 | 准确 | 新协议改用内核描述符锁，不再根据 PID 生存判断所有权；保守保留旧协议迁移检查 |
| tp_jobs 总行数无界 | 准确，仍为上线门槛 | 保留去重回执；不以删除回执引入历史命令重新执行。明确幂等期限/拒绝协议与删除政策仍需设计、验收 |
| runtime-store 事件应用原语未用于产品传输 | 准确，当前为独立库能力 | 不恢复已删除的公共 events 路由；产品继续消费修订号快照，不声称内部诊断事件已接入前端 |
| 前端覆盖率和 3D chunk | 仍需持续改进 | 新增离线真实应用入口回归；覆盖率实测列于下方。CharacterRig 仍大于 500 kB 且按需加载 |
| path-3d-stage 内部 JSON.parse | 同意审查者本轮修正 | 同一次计算中的 stringify 产物，未修改 |

## 修复机制与证据

### 1. 共享 HTTP 额度

[http-rate-limit.ts](../server/durable/http-rate-limit.ts) 实现已安装 Fastify 限速插件的 custom store。`tp_http_limits` 用原子 UPSERT 更新次数；窗口起止和过期清理都使用数据库时钟，应用时钟漂移不会刷新额度。桶键保存摘要，不保存原始 owner/IP。维持既有 owner/IP、匿名 IP 和 IPv6 /64 规则；默认每桶每分钟 600 次。插件接入依据为 [Fastify 官方 custom store 接口](https://github.com/fastify/fastify-rate-limit#custom-store)。

两个 API 实例共用同一数据库时，16 个并发请求只有 4 个得到 200，其余 12 个为 429；重新创建第三实例仍为 429，并返回 Retry-After。PGlite 另测 20 请求共用 3 次额度、不同地址分离、过期更新和应用时钟偏差。过期桶由独立维护任务每批最多清理 1000 条。

计数存储失败返回 `503/HTTP_LIMIT_UNAVAILABLE`，不退回每进程限流或自动放行。`/health` 是无需数据库的轻量存活检查，仍可响应；所有 API 包括 ready 都经过共享额度。该实现每请求多一次数据库写入，未据功能测试承诺生产吞吐或抗攻击容量。

### 2. 无行锁且一致的快照

[store.ts](../server/durable/store.ts) 的 `snapshot` 改为资源表与 latest-job 子查询的单条 LATERAL JOIN，不再调用 lockResource。只改为 FOR SHARE 仍可能等待写者；拆成两个独立 SELECT 则可能跨越一次提交，混合旧正文与新任务。PostgreSQL 的 Read Committed 对每条普通 SELECT 提供语句级 MVCC 快照；FOR SHARE 的等待行为见 [PostgreSQL 官方事务隔离说明](https://www.postgresql.org/docs/current/transaction-iso.html)。

[PostgreSQL gate](../server/durable/postgres.gate.mjs) 使用两个真实连接：写者在同一事务里更新正文及任务、持锁而不提交；读者必须在写者获准提交前读完，得到旧正文和 running 任务。解除屏障并提交后，读者同时得到新正文和 completed 任务。这验证了读取无需等资源行锁，也没有混读。PGlite 本身仍串行调度数据库操作，不将其说成 PostgreSQL 的并发执行能力。

### 3. 事件版本由 SQL 约束

`event` 用期望 revision 作为 UPDATE 条件，由数据库执行 revision + 1，并在同一 CTE 语句里插入事件。零行更新返回 `REVISION_CONFLICT`；诊断事件序号已占用则转换为 `EVENT_SEQUENCE_CONFLICT`。内存 resource 的 revision 在语句成功后才更新。原有业务事务与写锁保留，以保护正文、聊天、卡片等组合变更。

[共用测试](../server/durable/storage-cases.mjs) 在 PGlite 与 PostgreSQL 都直接使用根连接，并发提交两个旧版本副本；一个成功、一个类型化冲突。另故意预占下一事件序号，验证插入失败时资源版本和正文一起回滚。进度更新不重写正文的测试改用实际 `AFTER UPDATE OF body` 触发器，能发现无效的同值写回，不再依赖 SQL 的开头拼写。

### 4. 离线可发现的备份

[account-storage.ts](../src/learning-v2/account-storage.ts) 中模块变量仅作为通知 UI 的投影，pendingLocal/pendingSession 继续以持久备份为准。组件挂载、账号变化和 storage 事件触发读取；异步读取结果必须仍匹配当前账号与版本，避免旧账号结果污染当前提示。读取暂时失败不会清掉已知恢复状态。

原有代码并非完全没有刷新恢复：同账号 ensureSession 已会读取持久标记。但浏览器实测确认，登录接口离线时应用会进入 AuthLanding，知识页根本不会挂载。因此除了“我的”列表订阅，登录页也提供本机备份提示与导出；保持原有认证边界，不开放服务端账号内容。

在独立端口 54429 的真实浏览器中，API 代理指向未监听的 54428；[可复现页面](../qa/account-recovery-review.html) 先提交合成 IndexedDB 备份。进入真实 App 后显示恢复提示与导出按钮；关闭标签、销毁页面上下文再重新打开仍显示。再次核对：草稿仍只在 IndexedDB，导出数据完整，pending 未丢失。该测试没有模拟浏览器存储；UI 自动化另以 fake-indexeddb 覆盖模块重载、账号切换和组件更新。合成记录和测试标签已清理。

### 5. PGlite 文件锁

[pglite-owner.ts](../server/durable/pglite-owner.ts) 使用固定版本 `fs-native-extensions@1.5.1` 的 tryLock/unlock，动态加载仅发生在本地 PGlite 目录模式。内核持有描述符锁，进程退出后自动释放；相邻锁文件始终保留，避免删除重建产生两个不同 inode。依据为 [该库的官方描述符锁 API](https://github.com/holepunchto/fs-native-extensions)。

macOS 和 Linux Node 24 容器中均实际执行：两个子进程竞争只能有一个持有者；杀死持有者后，第三个持有者立即取得锁，即使 v2 标记文件还在。另覆盖同进程二次打开拒绝、旧活 PID 标记不被抢占。

边界：v2 不依赖 PID；旧版本尚未采用内核锁，升级时无法仅凭 PID 区分复用与真实旧进程，所以旧活 PID/不明标记仍保守拒绝，需要核对旧进程。该保证针对支持文件锁的本地文件系统，不对 NFS 等网络文件系统作分布式所有权承诺。生产多副本使用 PostgreSQL。

## 本次执行结果

| 验证 | 结果与范围 |
| --- | --- |
| npm run check | 主项目与测试 TypeScript 均通过 |
| npm run lint | 通过 |
| npm test | 371 个 Node 测试、17 个 UI 测试通过，0 失败、0 跳过 |
| npm run test:postgres | 独立 threadpeak_test 活库，7 项通过；不是 PGlite 替身 |
| Linux 文件锁 | Node 24 bookworm-slim 实际容器，2 项跨进程测试通过 |
| npm run test:coverage | 全套通过；Node 已加载且匹配统计范围的 TypeScript 行覆盖 90.98%，不代表全部前端源码 |
| 前端全源码覆盖 | 116 个非 vendor 源文件，行 833/3240 = 25.70%；语句 21.88%，分支 17.70%，函数 20.78% |
| npm run build | 通过；入口 375.23 kB，CharacterRig 704.11 kB 按需加载且仍告警；MarkdownMath 440.64 kB、path-3d-stage 363.86 kB 未超过 500 kB |
| 浏览器 | 真实 App 登录离线、完整重新打开、持久 pending 与完整导出内容核对通过；未将此称作所有 UI 行为覆盖 |

命令输出和结构化范围保存在 [本轮 QA 目录](../qa/architecture-review-round-3-2026-09-07/validation.json)。首次全量覆盖运行中暴露的 SQL 拼写断言已按数据库行为替换后重跑；未删除失败测试或放宽其业务要求。

## 保留的上线门槛

1. 去重回执数与保留/删除政策。有限保留期必须配套拒绝过期命令的协议，或另存可靠去重信息；不能直接删 tp_jobs 让相同历史命令再次调用 provider。本轮未擅定产品有效期。
2. HTTP 共享计数增加数据库写入，正式并发、等待、故障恢复和容量指标需按实际规模压测；任务维护压缩不等于总存储有界。
3. 画布编辑、作者全部交互、移动端操作仍未被前端测试全面覆盖；25.70% 行覆盖不能称为完整产品验收。
4. 实际 OAuth/身份服务、内容删除与备份策略、长材料摘要质量及生产负载门槛沿用主文档，不因本地测试通过而关闭。
