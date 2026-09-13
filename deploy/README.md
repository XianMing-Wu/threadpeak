# 生产部署与运行

此目录提供可复用的部署材料；某次部署的完成状态以带日期的真实验收记录为准。默认独立部署中，数据库不对宿主暴露端口，API 仅在容器网络，Caddy 提供同源静态站点与 HTTPS。已有 1Panel、PostgreSQL 和 OpenResty 的主机可使用下述复用方式。

## 配置与启动

1. 将 `.env.example` 复制为 `.env.production`，填写 provider、身份和公开源；不要提交该文件。`NODE_ENV=production` 下缺数据库、公开源、身份密钥/签发方/受众或两个LLM窗口与输出字段时拒绝启动。
2. 设置 `SITE_ADDRESS` 为实际域名，DNS 指向服务器；`THREADPEAK_PUBLIC_ORIGIN` 为同一 `https://域名`。开放 80/443 以签发证书。`POSTGRES_PASSWORD` 使用随机十六进制密码，避免数据库 URL 转义问题。
3. `THREADPEAK_IDENTITY_SECRET` 至少 32 字符，签发方通过 HS256 JWT 提供 `iss/aud/sub/exp`，可包含 `nbf`。身份网关在受信登录回调向 `/api/v2/session` 带 Bearer JWT，得到 Secure/HttpOnly cookie；浏览器不保存令牌。会话有效期不超过 JWT 过期时间和 1 小时。另有知乎 OAuth start/callback 实现；生产需要真实 OAuth 配置和独立联调验收，本地 mock 不能用于生产。`THREADPEAK_LOGIN_URL` 必须是已部署身份服务的 HTTPS 地址。网关须验证自身用户身份，不能信任浏览器自报 subject/owner。
4. 登录提供知乎账号与游客两种入口。游客必须由服务端显式签发隔离会话，使用同一持久工作流，不能访问收藏夹或授权个人资料；所有 Cookie 与 Bearer 都按服务端身份隔离，跨源请求拒绝。游客的活动与恢复 cookie 均使用 Secure/HttpOnly，退出后只有显式选择游客登录才能恢复。知乎登录仍需配置并验收真实授权回调映射，本地演示不能代替正式验收。

```sh
docker compose --env-file .env.production build
docker compose --env-file .env.production up -d
docker compose --env-file .env.production ps
```

Node 24 镜像提供 Poppler；PDF 主流程使用真实知乎解析 API，解析完成后从保留的原 PDF 用 pdftotext 有界提取完整文字层，再保留其中不存在的远端 OCR / 公式块，避免远端非空结果仍遗漏标题。提取限制 45 秒、8 MiB 输出与 200 万字符，受同一个大文件内存名额约束；没有文字层时不能伪造正文。上传暂存、任务 ID 与检查点在数据库，成功后删除原 PDF 暂存，保留解析正文和总结。API 使用非 root 用户和只读文件系统。镜像标签应在实际发布时锁定已验收 digest；同一批 API/worker 使用同一构建，不支持混用不同工作流合同版本滚动消费未完成任务。

向知乎发送 PDF 时，上传时限按实际文件大小和 256 KiB/s 传输速度预算，再留 120 秒响应时间，总上限 10 分钟；普通知乎 API 仍为 120 秒。上传占用同一个大文件内存名额并遵守两路知乎并发，用户取消和进程停机仍可中断。上传时限与后续最长 20 分钟的解析轮询分别计时，不能把低带宽下未传完的请求误认为解析失败。

## 2 核、4 GB VPS 的资源约束

Compose 默认分配 API 1.1 核 / 2 GiB、PostgreSQL 0.7 核 / 1 GiB、Caddy 0.2 核 / 256 MiB，合计 2 核 / 3.25 GiB，为操作系统保留约 768 MiB。容器不额外使用 swap；Node 老生代上限为 1280 MiB，给 Buffer、TLS 和运行时留空间。Docker 本地日志每服务轮转保留最多 3 × 10 MiB；带哈希的 /assets/ 静态文件长期缓存，HTML 重新验证。每个进程数据库连接池最多 10 个；worker 最多执行 4 个任务，超出任务保存在数据库队列。知乎调用仍共用两路和 2.1 秒发送间隔，排队不等于新增外部容量。

此配置针对累计几千用户、高峰 100–300 人在线；在线阅读、文件上传和同时生成必须分开验收。不要通过增加 worker 数突破内存预算或外部额度。持续监控请求 P95、队列最老任务年龄、数据库磁盘增长和容器 OOM。每账号来源额度不是整台机器的磁盘上限；磁盘容量、备份空间及告警须按实际资料量配置。

在开发机或 CI 构建镜像后上传镜像仓库，再在 VPS 拉取已验收的 digest；不在服务满载时原地运行 TypeScript/Vite 构建。`.dockerignore` 排除私有环境、数据库、验收材料和 `刘看山` 原始资料目录；运行时需要的已集成角色资产随网页发布。发布前实际启动 API 镜像，因为类型检查不能发现最终镜像漏拷贝服务端依赖。

## 复用 1Panel 的数据库与 HTTPS

按 [1Panel 文件管理](https://1panel.cn/docs/v2/user_manual/hosts/file/)、[编排管理](https://1panel.cn/docs/v2/user_manual/containers/compose/)和[网站创建](https://1panel.cn/docs/v2/user_manual/websites/website_create/)操作。源码、前端构建结果和运行镜像可以通过面板上传，无需在 VPS 上拉取 Git 或运行构建。

1. 在开发机为 VPS 的实际架构构建 API 镜像，例如 `docker build --platform linux/amd64 --target api -t threadpeak-api:版本 .`；通过 `docker save` 导出压缩包。源码包单独包含 `dist`，排除 `.git`、`node_modules`、`server/.data`、私有环境、QA、缓存和 `刘看山` 原始文件夹。
2. 上传到 `/opt/1panel/apps`，先核对 SHA-256，再解压到 `/opt/1panel/apps/threadpeak` 并通过 `docker load` 导入镜像。该应用目录限制为 `0700`，`.env.production` 为 `0600`；私有配置和备份不进入网站公开目录。
3. 在现有 PostgreSQL 实例中创建独立 `threadpeak` 库。`DATABASE_URL` 使用实际 PostgreSQL 容器名和容器内端口，正确 URL 编码用户名、密码；API 与 PostgreSQL 加入同一个已确认的 `1panel-network`。保留现有应用的库和端口绑定。
4. 将 [1panel.compose.yaml](1panel.compose.yaml) 复制为应用根目录的 `docker-compose.yml`，将镜像占位替换为已导入并验收的标签或 digest，或在面板编排环境变量中填写 `THREADPEAK_IMAGE`。在 1Panel「容器 → 编排 → 创建 → 路径选择」导入此文件，不勾选强制拉取。
5. `.env.production` 设置 `NODE_ENV=production`、`THREADPEAK_HOST=0.0.0.0`、`THREADPEAK_PORT=4312`、`NODE_OPTIONS=--max-old-space-size=768`，并填写真实 provider 与 OAuth 配置。公开源和 OAuth 回调使用正式 HTTPS 域名。OpenResty 使用 host 网络时，`THREADPEAK_TRUSTED_PROXIES` 填实际 Docker 网桥网关的 `/32`，先用 `docker network inspect` 核对，不照抄其他主机地址。
6. 创建静态网站并选择已有证书；把 `dist` 内容复制到面板显示的网站运行目录。保留面板管理的证书路径、ACME 规则与 HTTPS 跳转。在该站点 server 块内代理 `/api/` 和精确 `/health` 到 `http://127.0.0.1:4312`；API 使用 HTTP/1.1，转发 Host、实际客户端 IP 和协议，关闭请求/响应缓冲，读写超时 120 秒，上传限制 `101m`。根路径使用 `try_files $uri $uri/ /index.html`，`/assets/` 文件不存在返回 404，缓存一年；HTML 重新验证。
7. 安全头遵循 [Caddyfile](Caddyfile) 的两类页面合同：工作区禁止嵌入；仅 `/introduction.html` 允许同源嵌入和其 Rive 所需的 `wasm-unsafe-eval`。Nginx 的 location 内增加 `add_header` 会改变继承，介绍页应同时保留 HSTS、nosniff 和 Referrer-Policy。`nginx -t` 成功后平滑 reload OpenResty。

此模板只新增 API：1.1 核、1280 MiB，Node 堆 768 MiB；复用主机原有数据库、HTTPS 和其他服务。它与独立 Compose 的整机资源分配不同，须按已有 MySQL、网盘等应用占用重新实测。用公网 HTTPS 完成真实登录、收藏导入、PDF、路线、学习与刷新验收，并在实际 PostgreSQL 上执行隔离的 `threadpeak_test` 门禁、目标负载和新库备份恢复演练。高峰在线阅读量不等于可同时执行同等数量的 AI 生成，模型与知乎队列仍服从既定并发和上游额度。

## 健康、任务与恢复

- `/health` 只表示进程可响应；`/api/ready` 检查数据库连接与必需 provider 配置，不主动调用收费 provider，不能等同外部服务健康。
- 用 `docker compose --env-file .env.production exec api npm run ops:queue` 查看状态与待处理错误计数。监控 waiting 数、过期租约、各阶段 p50/p95 时延、429/鉴权/预算错误和外部费用；实际容量阈值需压测制定。
- worker 5 秒续租、90 秒租约；进程崩溃后新 worker 接管。并发池在 PostgreSQL 中跨副本共享；PGlite 只允许一个目录所有者进程。正常停机会按 job/fence 立即交回队列，保留检查点和重试预算，并阻断迟到提交；忽略 abort 的 handler 最多等待 10 秒。数据库失联仍需租约恢复；已完成步骤不重跑。外部生成仍可能因断电重试，不能承诺收费调用恰好一次。
- 自动恢复以实际失败计数，最多四次失败；配置错误等保留待继续状态。手动恢复每任务最多四次、间隔至少 30 秒并占用账号额度；ops:queue 报告耗尽恢复预算的任务。排除根因后用户继续同一任务，勿清空检查点伪造恢复。旧工作流版本的待处理任务应在旧镜像完成/停止，或编写显式迁移后再升级。结构化步骤检查点包含实际 prompt、provider 能力和正式输出策略身份；摘要另含完整策略与模型命名空间。本次升级不删除历史检查点：同身份复用；受影响步骤按保存的原始输入重新校验/执行，检索原始分支可复用。受影响模型调用可能重新计费。若输入 hash 冲突则保留任务并报告 CHECKPOINT_VERSION_CONFLICT，须按具体合同迁移，不能清空数据库绕过。

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

所有 API 路由在限速存储故障时返回 503/HTTP_LIMIT_UNAVAILABLE，不降级成放行或进程内独立额度；/health 只返回进程存活，不访问数据库，也不计入该额度。共享计数每次请求增加一次 SQL 写入，正式吞吐和数据库容量仍需压测，不能把多实例功能测试当作抗攻击容量证明。 PostgreSQL 建连超时 5 秒；共享 HTTP 计数超过 2.5 秒按存储不可用返回 503，迟到结果不能重新放行或重复响应，数据库故障时 readiness 不无限等待。

维护首次延迟 60 秒，成功后一小时重跑；满批次一分钟后续跑，失败退避至多 15 分钟。监控 worker.maintenance_failed 和 worker.release_failed 的错误码。每类删除最多 1000 行、任务压缩最多 100 行，锁超时 1 秒、语句超时 5 秒。任务回执仍随命令数增长，不能把压缩视为账号删除政策。

浏览器账号备份主要存入 IndexedDB，与 localStorage 的小容量限制分开。只有持久备份成功后才清理旧账号键；恢复不下的草稿可在“我的”页面导出。恢复提示独立读取持久元数据；重新打开页面或登录服务离线时，登录页仍提供本机备份导出。两种存储都不可写时保留原字节并提示导出/释放空间，不静默丢弃草稿。可复现页面与证据见 [QA](../qa/README.md)。

本地 PGlite 使用 fs-native-extensions 的内核描述符锁；进程退出或被杀后锁自动释放，新所有者不靠 PID 判断。相邻 .threadpeak-lock 文件必须保留稳定 inode，运行期间不得删除/替换。v2 所有权标记用于兼容迁移；旧 PID 标记若仍有存活/不可判断的进程则拒绝接管，需要核对旧进程后再迁移。该保证用于支持文件锁的本地文件系统，不是网络文件系统分布式锁；多副本部署使用 PostgreSQL。

## 演示视频

介绍页左侧“演示视频”打开独立 `video.html`，不需要登录，也不请求工作区 API。播放器使用原生 controls、playsinline、preload=none；进入介绍页不预加载视频，进入播放页先显示封面，用户点击后才加载正文。

视频和封面放在 `public/media/`（Git 已忽略），当前代码引用 `project-demo-35f7c6c565c7.mp4` 与同名 `.jpg`。`npm run build` 将它们复制到 `dist/media/`；仅将提供的 MP4 和封面复制到此目录，不复制私有来源文件夹。MP4 采用 H.264/AAC，准备时用 `ffmpeg -i input.mp4 -map 0:v:0 -map 0:a:0 -c copy -movflags +faststart output.mp4` 前置索引，不重编码；更新视频时更换文件名与代码引用，避免浏览器长期缓存旧版本。

1Panel 的站点静态 server 块内使用 [静态媒体配置](demo-video.nginx.conf)，沿用现有 root、TLS 和安全头。视频不经 Node API、代理缓存或服务端转码，每位用户使用同一个文件；关闭该路径访问日志，不随播放增长日志。Nginx 支持 Range/206，允许单区间请求，版本化资源可由浏览器长期缓存；文件不存在返回 404。Caddy 示例也有独立媒体 file_server，不把不存在的视频回退成 HTML。底层操作系统可能使用可回收的共享文件页缓存，这不是逐用户生成的磁盘文件。

发布时先校验媒体哈希和可播放性，再发布入口。验证响应的 Content-Type、Range/206、Content-Range、304 与缓存头，并核对重复/并发播放前后的媒体文件数和临时目录；不能把浏览器缓存表述为 VPS 内存或磁盘无限增长。部署包是一次性运维文件，不按观看次数生成，应按部署归档保留策略管理。

原片约 2 Mbit/s，100 位同时观看约需 200 Mbit/s 出口；静态共享解决重复文件和后端计算，不改变出口带宽上限。应按 VPS 实际带宽评估同时观看量，必要时把同一版本文件放到已配置的 CDN/对象存储。

参考：[Nginx sendfile 与 Range 控制](https://nginx.org/en/docs/http/ngx_http_core_module.html#sendfile)、[HTML video 的 controls 与 preload](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/video)。
