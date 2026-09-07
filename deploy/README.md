# 生产部署与运行

此目录提供部署材料，未代表已经部署到公网。实际域名、服务器及身份服务尚需用户配置。默认数据库不对宿主暴露端口，API 仅在容器网络，Caddy 提供同源静态站点与 HTTPS。

## 配置与启动

1. 将 `.env.example` 复制为 `.env.production`，填写 provider、身份和公开源；不要提交该文件。`NODE_ENV=production` 下缺数据库、公开源、身份密钥/签发方/受众或模型窗口时拒绝启动。
2. 设置 `SITE_ADDRESS` 为实际域名，DNS 指向服务器；`THREADPEAK_PUBLIC_ORIGIN` 为同一 `https://域名`。开放 80/443 以签发证书。`POSTGRES_PASSWORD` 使用随机十六进制密码，避免数据库 URL 转义问题。
3. `THREADPEAK_IDENTITY_SECRET` 至少 32 字符，签发方通过 HS256 JWT 提供 `iss/aud/sub/exp`，可包含 `nbf`。身份网关在受信登录回调向 `/api/v2/session` 带 Bearer JWT，得到 Secure/HttpOnly cookie；浏览器不保存令牌。会话有效期不超过 JWT 过期时间和 1 小时。当前实现为受信网关合同，尚无开箱即用知乎 OAuth callback。`THREADPEAK_LOGIN_URL` 必须是已部署身份服务的 HTTPS 地址。网关须验证自身用户身份，不能信任浏览器自报 subject/owner。
4. 生产服务不提供匿名绕过。Cookie 与 Bearer 都按服务端身份隔离，跨源请求拒绝。若要继续知乎登录，应先实现并验收真实授权回调映射，不把本地工作区当正式登录。

```sh
docker compose --env-file .env.production build
docker compose --env-file .env.production up -d
docker compose --env-file .env.production ps
```

Node 24 镜像含供旧隔离测试使用的 pdftotext；默认 PDF 资料使用知乎解析 API，上传暂存、任务 ID 与检查点在数据库，成功后删除原 PDF 暂存，保留解析正文和总结。API 使用非 root 用户和只读文件系统。镜像标签应在实际发布时锁定已验收 digest；同一批 API/worker 使用同一构建，不支持混用不同工作流合同版本滚动消费未完成任务。

## 健康、任务与恢复

- `/health` 只表示进程可响应；`/api/ready` 检查数据库连接与必需 provider 配置，不主动调用收费 provider，不能等同外部服务健康。
- 用 `docker compose --env-file .env.production exec api npm run ops:queue` 查看状态与待处理错误计数。监控 waiting 数、过期租约、各阶段 p50/p95 时延、429/鉴权/预算错误和外部费用；实际容量阈值需压测制定。
- worker 5 秒续租、30 秒租约；进程崩溃后新 worker 接管。并发池在数据库中共享。停止阻断迟到提交；已完成步骤不重跑。外部生成仍可能因断电重试，不能承诺收费调用恰好一次。
- 临时错误最多四次自动尝试；配置错误等保留待继续状态。排除根因后用户继续同一任务，勿清空检查点伪造恢复。旧工作流版本的待处理任务应在旧镜像完成/停止，或编写显式迁移后再升级。

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
