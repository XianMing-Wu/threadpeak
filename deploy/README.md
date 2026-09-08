# 生产部署与运行

此目录提供部署材料，未代表已经部署到公网。实际域名、服务器及身份服务尚需用户配置。默认数据库不对宿主暴露端口，API 仅在容器网络，Caddy 提供同源静态站点与 HTTPS。

## 配置与启动

1. 将 `.env.example` 复制为 `.env.production`，填写 provider、身份和公开源；不要提交该文件。`NODE_ENV=production` 下缺数据库、公开源、身份密钥/签发方/受众或六个模型/直答窗口与输出字段时拒绝启动。
2. 设置 `SITE_ADDRESS` 为实际域名，DNS 指向服务器；`THREADPEAK_PUBLIC_ORIGIN` 为同一 `https://域名`。开放 80/443 以签发证书。`POSTGRES_PASSWORD` 使用随机十六进制密码，避免数据库 URL 转义问题。
3. `THREADPEAK_IDENTITY_SECRET` 至少 32 字符，签发方通过 HS256 JWT 提供 `iss/aud/sub/exp`，可包含 `nbf`。身份网关在受信登录回调向 `/api/v2/session` 带 Bearer JWT，得到 Secure/HttpOnly cookie；浏览器不保存令牌。会话有效期不超过 JWT 过期时间和 1 小时。另有知乎 OAuth start/callback 实现；生产需要真实 OAuth 配置和独立联调验收，本地 mock 不能用于生产。`THREADPEAK_LOGIN_URL` 必须是已部署身份服务的 HTTPS 地址。网关须验证自身用户身份，不能信任浏览器自报 subject/owner。
4. 生产服务不提供匿名绕过。Cookie 与 Bearer 都按服务端身份隔离，跨源请求拒绝。采用知乎登录时应配置并验收真实授权回调映射，不把本地工作区当正式登录。

```sh
docker compose --env-file .env.production build
docker compose --env-file .env.production up -d
docker compose --env-file .env.production ps
```

Node 24 镜像不安装已无调用方的 Poppler。PDF 资料使用知乎解析 API，上传暂存、任务 ID 与检查点在数据库，成功后删除原 PDF 暂存，保留解析正文和总结。API 使用非 root 用户和只读文件系统。镜像标签应在实际发布时锁定已验收 digest；同一批 API/worker 使用同一构建，不支持混用不同工作流合同版本滚动消费未完成任务。

## 健康、任务与恢复

- `/health` 只表示进程可响应；`/api/ready` 检查数据库连接与必需 provider 配置，不主动调用收费 provider，不能等同外部服务健康。
- 用 `docker compose --env-file .env.production exec api npm run ops:queue` 查看状态与待处理错误计数。监控 waiting 数、过期租约、各阶段 p50/p95 时延、429/鉴权/预算错误和外部费用；实际容量阈值需压测制定。
- worker 5 秒续租、90 秒租约；进程崩溃后新 worker 接管。并发池在 PostgreSQL 中跨副本共享；PGlite 只允许一个目录所有者进程。正常停机会按 job/fence 立即交回队列，保留检查点和重试预算，并阻断迟到提交；忽略 abort 的 handler 最多等待 10 秒。数据库失联仍需租约恢复；已完成步骤不重跑。外部生成仍可能因断电重试，不能承诺收费调用恰好一次。
- 自动恢复以实际失败计数，最多四次失败；配置错误等保留待继续状态。手动恢复每任务最多四次、间隔至少 30 秒并占用账号额度；ops:queue 报告耗尽恢复预算的任务。排除根因后用户继续同一任务，勿清空检查点伪造恢复。旧工作流版本的待处理任务应在旧镜像完成/停止，或编写显式迁移后再升级。结构化步骤与直答检查点包含实际 prompt、provider 能力和正式输出策略身份；摘要另含完整策略与模型命名空间。本次升级不删除历史检查点：同身份复用；受影响步骤按保存的原始输入重新校验/执行，检索原始分支可复用。受影响模型调用可能重新计费。若输入 hash 冲突则保留任务并报告 CHECKPOINT_VERSION_CONFLICT，须按具体合同迁移，不能清空数据库绕过。

## 备份与恢复演练

数据库保存用户原文、附件文本、卡片副本和会话令牌；备份应加密、限制访问并设置独立保留周期。不要向日志写连接密码。以下路径由运维在受限目录执行：

```sh
umask 077
docker compose --env-file .env.production exec -T db pg_dump -U threadpeak -d threadpeak -Fc > threadpeak.dump
# 恢复到新的验收库，先验证，再安排正式切换；不得直接覆盖在用库。
docker compose --env-file .env.production exec db createdb -U threadpeak threadpeak_restore
docker compose --env-file .env.production exec -T db pg_restore -U threadpeak -d threadpeak_restore --exit-on-error < threadpeak.dump
```

验收资源/任务/事件数、用户隔离、样本原文/图、任务恢复与登录；只看 pg_restore 退出码不足。对正式库重置、删除卷、不可逆迁移必须单独明确授权。`docker compose down -v` 会删数据，不用作升级命令。

## 上线门槛

真实身份和退出/过期/多设备流程；实际域名与 TLS；按目标并发量压测；真实长材料和多轮对话的摘要保真评测；内容及备份保留/删除政策；provider 配额/计费告警；原有数据迁移或只读归档说明。完成这些门槛前，只能称已完成相应本地集成切片。

ops:queue 按最近 24 小时输出 provider/阶段的 P50/P95、失败数、检查点/响应缓存命中及上游实际 usage；未知 usage 保持 null。摘要、步骤和任务是嵌套时间段，不能相加当总时长。队列指标为实际名额等待，任务 ageAtStartMs 含此前恢复等待。维护日志单独报告各类清理数量、是否满批与耗时。

内部诊断事件保留 7 天；公共 events 路由已移除，前端使用 revision 快照轮询。完成任务 30 天后压缩重复输入和检查点，保留已发布资源与幂等回执。等待/取消任务仍保存恢复所需内容。机制见[工程设计](../docs/engineering.md)，执行证据见 [QA](../qa/README.md)。


## 代理、维护与浏览器备份

Compose 使用独立 proxy 网段 172.30.84.0/24，Caddy 固定为 172.30.84.2；API 的 THREADPEAK_TRUSTED_PROXIES 仅信任该 /32。该网段如与目标主机冲突，需同时修改网络、Caddy 地址和可信地址。独立部署默认为不信任转发头，可用逗号分隔 IP/CIDR 设置可信代理，禁止直接信任全部来源。已认证请求按 owner/IP 分桶；登录/公开入口与认证失败按 IP 分桶，IPv6 规范化到 /64。默认每桶 600 次/分钟，由同一数据库的 tp_http_limits 原子计数，所有 API 副本及重启后的实例共用。桶键只存摘要；窗口与过期清理均采用数据库时间。数据库另执行账号任务额度。

所有 API 路由在限速存储故障时返回 503/HTTP_LIMIT_UNAVAILABLE，不降级成放行或进程内独立额度；/health 只返回进程存活，不访问数据库，也不计入该额度。共享计数每次请求增加一次 SQL 写入，正式吞吐和数据库容量仍需压测，不能把多实例功能测试当作抗攻击容量证明。

维护首次延迟 60 秒，成功后一小时重跑；满批次一分钟后续跑，失败退避至多 15 分钟。监控 worker.maintenance_failed 和 worker.release_failed 的错误码。每类删除最多 1000 行、任务压缩最多 100 行，锁超时 1 秒、语句超时 5 秒。任务回执仍随命令数增长，不能把压缩视为账号删除政策。

浏览器账号备份主要存入 IndexedDB，与 localStorage 的小容量限制分开。只有持久备份成功后才清理旧账号键；恢复不下的草稿可在“我的”页面导出。恢复提示独立读取持久元数据；重新打开页面或登录服务离线时，登录页仍提供本机备份导出。两种存储都不可写时保留原字节并提示导出/释放空间，不静默丢弃草稿。可复现页面与证据见 [QA](../qa/README.md)。

本地 PGlite 使用 fs-native-extensions 的内核描述符锁；进程退出或被杀后锁自动释放，新所有者不靠 PID 判断。相邻 .threadpeak-lock 文件必须保留稳定 inode，运行期间不得删除/替换。v2 所有权标记用于兼容迁移；旧 PID 标记若仍有存活/不可判断的进程则拒绝接管，需要核对旧进程后再迁移。该保证用于支持文件锁的本地文件系统，不是网络文件系统分布式锁；多副本部署使用 PostgreSQL。
