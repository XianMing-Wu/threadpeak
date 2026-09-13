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

PDF 使用真实知乎异步解析 API，并用 Poppler 的 pdftotext 核对、保留完整文字层，补充远端独有的 OCR / 公式块。生产镜像已安装 poppler-utils 和中文映射 poppler-data；本地开发可用 Homebrew 安装 poppler，Debian/Ubuntu 安装这两个包。没有本机提取器时仅能使用远端结果，不能保证远端保留全部标题。全网检索沿用知乎开发者服务中的站外检索能力。模型、检索和 PDF 服务不可用时不会自动切换示例结果。

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
| `ZHIHU_OAUTH_USERINFO_URL` | 默认 `https://openapi.zhihu.com/user` |
| `ZHIHU_OAUTH_USER_ID_PATH` | 官方接口默认 `uid`，必须是稳定用户 ID |
| `ZHIHU_OAUTH_USER_NAME_PATH` | 官方接口默认 `fullname` |
| `ZHIHU_OAUTH_USER_AVATAR_PATH` | 官方接口默认 `avatar_path` |
| `THREADPEAK_TOKEN_SECRET` | 至少 32 字符的服务端 Token 加密密钥，重启及多副本须保持一致 |

本地设置 `ZHIHU_OAUTH_MODE=mock` 可体验演示账号、收藏夹和公开创作的导入链。演示采用独立账号和来源 ID，并明确标记；它只替代授权/用户内容接口，模型、搜索和 PDF 仍是真实 provider。`NODE_ENV=production` 拒绝 mock。未显式提供演示 Token 密钥时，本地服务在数据目录保存专用密钥。

正式模式依据[官方用户信息合同](https://www.zhihu.com/ring/moltbook/api/oauth/user_info)读取 `uid/fullname/avatar_path`；手机号、邮箱及其他个人字段不保存或返回浏览器。超过 JavaScript 安全整数范围的数字 uid 从原始 JSON 数字无损转为字符串，不能先四舍五入再绑定账号；运行环境要求 Node.js 24 及以上。旧演示资料不会合并到真实账号。自定义用户信息接口时必须显式配置稳定 ID 路径，不能把昵称或 token 当身份。

本地开发在 `.env` 设置 `THREADPEAK_PUBLIC_ORIGIN=http://127.0.0.1:4301` 和 `ZHIHU_OAUTH_REDIRECT_URI=http://127.0.0.1:4301/api/auth/zhihu/callback`，并在知乎应用后台登记完全相同的回调地址。用 `npm run server` 和 `npm run dev -- --strictPort` 启动后，始终从 `http://127.0.0.1:4301` 登录；`localhost`、其他端口及 API 的 `4312` 端口不等同于此地址。生产改成实际 HTTPS 域名并同步后台登记。设置本地 `.env` 不会修改知乎后台的登记值。

知乎授权页的应用图标来自知乎后台的项目 ICON 配置；上传 [threadpeak-icon.png](../public/threadpeak-icon.png) 并保存。该 512 × 512 图标由 `src/icons.tsx` 的原版 MountainMark 矢量导出；修改本地登录按钮不会同步远端应用图标。

回调优先读取 `authorization_code`，兼容 `code`；必须校验服务端持久保存的随机 state、当前浏览器 HttpOnly Cookie、十分钟有效期及单次消费。缺少 state、重复回调或身份资料不完整均不签发会话。实际 state 回传必须用真实授权验收，不能用 Cookie 值补造。授权取消、限流、失败均回到固定本地页面，清理尝试 Cookie，不转发上游错误文本。

OAuth Token 以 AES-256-GCM 加密保存，浏览器只接收随机会话 Cookie。有效期使用真实 `expires_in`；[官方 OAuth 说明](https://www.zhihu.com/ring/moltbook/api/oauth/zhihu_oauth_skill)尚不支持 refresh_token，设置页和收藏夹读取失败提示提供重新连接入口。Token 过期不删除既有路线及资料，重新登录相同 uid 恢复原工作区；不同 uid 保持隔离。退出仅撤销当前活动会话，其他设备和已接受的后台任务按原有持久合同继续；未虚构上游撤销接口。

用户内容请求同时携带平台 Access Secret 与当前用户 Token，鉴权失败即停止，不重试为开发者本人数据。平台鉴权错误未区分两种凭据时只提示授权校验失败，不声称一定是用户 Token 过期。真实授权、收藏读取与生产部署的验收范围记录于 [QA](../qa/README.md)。

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

## 模型与思考强度

`DEEPSEEK_MODEL_NAME=deepseek-flash` 同时用于快速回答和深度思考。快速显式 `thinking=disabled` 且不传 reasoning_effort；深度显式 `thinking=enabled`、`reasoning_effort=low`；首页新任务默认快速。R2 名称提取保留 `thinking=disabled` 的短提取例外。 最终路线生成 R4 是快速模式的唯一思考例外：也使用 enabled/low，同一步骤修复保持 low；其他快速步骤仍 disabled。已有任务冻结的深度不被界面默认值覆盖。参数依据见 [DeepSeek 官方说明](https://api-docs.deepseek.com/zh-cn/guides/thinking_mode/)。状态条读取模型实际思考流，与正式正文及校验结果独立；不用服务日志保存思考全文。
