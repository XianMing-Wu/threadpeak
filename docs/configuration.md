# 配置指南

从仓库根目录复制 `.env.example` 为 `.env`，再填写实际配置。服务端启动时读取 `.env`，非空进程环境变量优先；空值视为未配置，保留默认值。修改后重启 API。前端仅需知道 API 代理地址，不接收 provider 凭证。

## 生成服务

| 变量 | 用途 |
| --- | --- |
| `DEEPSEEK_API_KEY` | 模型 API 凭证 |
| `DEEPSEEK_BASE_URL` | 模型服务地址；按所用服务的接口配置 |
| `DEEPSEEK_MODEL_NAME` | 实际可用的模型标识 |
| `DEEPSEEK_CONTEXT_TOKENS` | 本轮按用户指定显式设为 `500000`；它是上下文窗口，单次输出上限独立，其他provider仍需配置各自能力 |
| `DEEPSEEK_MAX_OUTPUT_TOKENS` | 模型单次最大输出；发送的 max_tokens 不超过此值 |
| `ZHIHU_ACCESS_SECRET` | 知乎开发者 API 凭证 |
| `ZHIHU_API_BASE_URL` | 知乎检索与资料服务地址 |

五个 provider 连接字段必须完整，生成管线才进入就绪状态。生产还必须显式填写上述六个窗口/输出字段；窗口接受 32,000–2,000,000，输出接受 1,024–131,072，输出加 4,096 必须小于有效窗口（业务上限 500,000）。配置依据应记录实际服务、模型、能力文档及核对日期，不按模型名字推测。

本地模型未配置时使用应用保守默认窗口64,000、输出16,384；这不是厂商能力声明。配置的窗口与业务上限500,000取较小值，再扣输出与安全余量；UTF-8字节上界是保守预检，真实usage单独记录。所有讲解由LLM生成，知乎仅用于搜索及资料接口；已移除直答和四项ZHIHU_FAST/DEEP窗口配置，生产只需明确LLM窗口与输出上限。校验入口见 [capabilities.ts](../server/durable/capabilities.ts)、[config.ts](../server/config.ts) 和 [bootstrap.ts](../server/durable/bootstrap.ts)。

PDF 使用知乎异步解析 API，默认管线不依赖本机 pdftotext。全网检索沿用知乎开发者服务中的站外检索能力。模型、检索和 PDF 服务不可用时不会自动切换示例结果。

## 本地运行与数据库

| 变量 | 默认 / 用途 |
| --- | --- |
| `THREADPEAK_PORT` | API 端口，默认 `4312` |
| `THREADPEAK_HOST` | API 监听地址，默认 `127.0.0.1` |
| `THREADPEAK_DATA_DIR` | 本地数据目录，默认 `server/.data/product-v2` |
| `DATABASE_URL` | 提供时使用 PostgreSQL；本地留空使用 PGlite |
| `THREADPEAK_API_TARGET` | Vite 代理目标，默认 `http://127.0.0.1:4312`；通过启动前端的进程环境设置 |
| `THREADPEAK_TRUSTED_PROXIES` | 逗号分隔的可信代理 IP/CIDR；默认不信任转发头 |

修改开发端口的例子：

```sh
# 终端一
THREADPEAK_PORT=4313 npm run server
```

```sh
# 终端二
THREADPEAK_API_TARGET=http://127.0.0.1:4313 npm run dev -- --port 4302
```

PGlite 数据目录只允许一个进程持有；多个 API/worker 实例使用同一个 PostgreSQL。`.env`、`server/.data` 与本地浏览器资料不属于可清理的构建产物。游客显式登录后以 Cookie 恢复身份；退出撤销活动会话并保留当前浏览器的恢复凭据。清除 Cookie 不等于删除数据库，也无法凭空找回游客身份。知乎与游客记录分别保存，详情见[身份与所有权](engineering.md#本地存储与所有权)。

## 知乎账号与演示模式

`ZHIHU_ACCESS_SECRET` 不能替代用户授权。读取个人收藏夹、公开创作和账号资料需要 OAuth 适配器。

| 变量 | 用途 |
| --- | --- |
| `ZHIHU_OAUTH_MODE` | `real` 或显式的本地 `mock` |
| `ZHIHU_OAUTH_APP_ID` | 已申请的应用 ID |
| `ZHIHU_OAUTH_APP_KEY` | 应用密钥 |
| `ZHIHU_OAUTH_REDIRECT_URI` | 已登记的授权回调地址 |
| `ZHIHU_OAUTH_USERINFO_URL` | 官方用户信息接口 |
| `ZHIHU_OAUTH_USER_ID_PATH` | 响应中稳定用户 ID 的字段路径 |
| `ZHIHU_OAUTH_USER_NAME_PATH` | 可选的昵称字段路径 |
| `ZHIHU_OAUTH_USER_AVATAR_PATH` | 可选的头像字段路径 |
| `THREADPEAK_TOKEN_SECRET` | 服务端授权 Token 的加密密钥 |

本地设置 `ZHIHU_OAUTH_MODE=mock` 可体验演示账号、收藏夹和公开创作的导入链。演示采用独立账号和来源 ID，并明确标记；它只替代授权/用户内容接口，模型、搜索和 PDF 仍是真实 provider。`NODE_ENV=production` 拒绝 mock。未显式提供演示 Token 密钥时，本地服务在数据目录保存专用密钥。

切回 `real` 后必须完成真实授权回调和字段映射联调；旧演示资料不会合并到真实账号。稳定 ID、state 回传及账号资料合同以正式获批的接口为准，不按显示名猜测。

## 生产身份与部署

| 变量 | 用途 |
| --- | --- |
| `THREADPEAK_PUBLIC_ORIGIN` | 实际 HTTPS 公开源 |
| `THREADPEAK_IDENTITY_SECRET` | 受信身份网关的签名验证密钥 |
| `THREADPEAK_IDENTITY_ISSUER` | 预期 JWT 签发方 |
| `THREADPEAK_IDENTITY_AUDIENCE` | 预期 JWT 接收方 |
| `THREADPEAK_LOGIN_URL` | 身份服务的 HTTPS 登录入口 |
| `POSTGRES_PASSWORD` | Compose PostgreSQL 密码 |
| `SITE_ADDRESS` | Caddy 站点域名 |

生产使用 PostgreSQL，并配置真实知乎 OAuth 或可信身份网关；密钥、Cookie、CSRF、代理白名单及备份恢复要求见[部署手册](../deploy/README.md)。受信网关不能接受浏览器自报的 subject 作为已认证身份。

## 检查连接

- `GET /health`：仅检查 API 进程能否响应。
- `GET /api/ready`：检查数据库和必需 provider 配置，不主动发起收费调用。
- `npm run ops:queue`：查看任务状态和错误类别计数。

配置完整不代表外部服务实时可用。故障排查先看真实任务状态、错误类别及对应服务额度，不通过删除检查点或切换演示数据伪造成功。

### 资料存储额度

`THREADPEAK_MATERIAL_MAX_COUNT` 默认 500；`THREADPEAK_MATERIAL_MAX_BYTES` 默认 1073741824（1 GiB）。必须为正的安全整数，对每个所有者统一生效，额度满返回可读错误，不删除已有资料。知乎导入按每份至少 8 MiB 预留；这不是整个数据库（含检查点与索引）的磁盘预算。部署容量仍须单独测量。
