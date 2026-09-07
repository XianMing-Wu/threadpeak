# 知乎授权域可切换演示适配

用户本轮明确要求 OAuth 及全部授权用户 API 暂用 mock，接口与正式适配一致。该裁决仅覆盖授权域，搜索、全网搜索、直答、LLM、PDF 仍使用实际 provider。本说明是本轮分工接线记录；主代理将其同步进两份核心合同与最终验收账本。

## 模式与配置

- `ZHIHU_OAUTH_MODE=real|mock`，缺省及空值均为 `real`，其他值直接报配置错误。`.env.example` 增加该键；未修改 `.env` 或写入应用密钥。
- `mock` 不需要 app_id/app_key/用户信息 URL。`THREADPEAK_PUBLIC_ORIGIN` 决定浏览器回调同源地址，未配置时本地演示默认 `http://127.0.0.1:4304`；若显式设置回调，仍要求同源且路径为 `/api/auth/zhihu/callback`。
- 本地演示无需人工生成密钥。bootstrap 在 `THREADPEAK_DATA_DIR/zhihu-oauth-demo.key` 持久保存随机服务端密钥（文件权限 0600），服务器/worker 重建可读取原有账号令牌。测试直接创建登录配置时仅使用进程内随机键。
- `NODE_ENV=production` 在配置解析和适配构造时拒绝 `mock`。切回 `real` 启动时清除演示工作区会话；保留其已存资源，但真实账号不会继承这些资源。真实/演示 OAuth Token 也不能混用。
- 正式接入仍需申请应用凭证和官方用户信息接口/稳定 ID 字段合同，并验证 state 回传；mock 不证明真实知乎授权已通过。

## 主代理接线

未修改 `http.ts`、`materials-http.ts`、`flows.ts` 或作者网络文件。

| 入口 | 约定 |
| --- | --- |
| `/api/auth/config` | 原字段保留，新增 `zhihuMode: ports.zhihuLogin?.config.mode ?? null`。`zhihuAvailable` 仍检查是否已创建适配 |
| `/api/auth/zhihu/start` | `login.start(existingOwner?)` 返回 `{authorizeUrl,cookie}`；原响应保留，新增 `mode: login.config.mode` |
| 浏览器 `requestAuthStart` | real 仍仅允许知乎 authorize URL；mock 仅接受 `mode==='mock'` 的同源 `/api/auth/zhihu/callback`，有 authorization_code 和 state，不能通用放行任意 URL |
| `/api/auth/zhihu/callback` | 调用方式不变：`login.callback(code,state,binding)`，设置返回工作区 Cookie。演示直接跳本地回调并走同样的状态和浏览器绑定校验 |
| `/api/v2/session` | 原返回结构保留，profile 中已有 `demo:boolean`、`mode:real|mock`、演示名称；provider 可继续使用 `zhihu` |
| `/api/auth/session` | 原接口可保留 provider；如增加 demo/mode 标记也仅属附加字段 |
| 资料导入与网络 | 授权域 API 原始示例 URL 使用保留域 `https://zhihu-demo.invalid`。仅在 mock owner 且 `api.userMode==='mock'` 时放行，作者 ID 使用演示命名空间。正式账号不得接受演示来源；UI 不跳转 `.invalid`，显示“示例来源” |

`zhihu-oauth-mock.ts` 导出 `isMockZhihuOwner(owner)`、`isMockZhihuUrl(url)`、`MOCK_ZHIHU_ORIGIN`、`MOCK_ZHIHU_OWNER_PREFIX`。owner 前缀为 `account:zhihu:mock:`，平台示例作者 token 前缀为 `threadpeak-demo-`。禁止按展示名合并，资料中刻意保留了同名不同作者。

主代理可在 HTTP 的 owner 解析之后增加同模式守卫：生产或 real 模式一律拒绝 mock owner。bootstrap 已删除切换模式后可用的 mock 会话，此守卫可进一步保护绕过 bootstrap 的单独 HTTP 入口。

bootstrap 已为 `ZhihuProvider.globalSearch` 保留与 search 相同的 `zhihu` 并发池；收藏导入不再依赖 LLM 配置是否完整。其他任务仍严格要求真实 provider。mock 下即使没有 Access Secret，zhihuData 也会存在，因此 PDF 上传可用性应检查真实 Access Secret，不能只检查对象存在。

## 数据合同与隔离

同一个 `ZhihuDataClient.user()` 消费相同参数并返回官方 `Data` 对象，内部 mock 保留 `Code/Message/Data` 信封。无需让业务流程按 mock/real 改字段。

- `favlists`：`Items` 内包含 UrlToken/Url/Title/Description/IsPublic，无 Paging。
- `favlist_contents`：ContentItem + FavTime/Favlists/可选 Author，分页含 IsEnd、字符串 NextOffset（未结束时）、Totals。
- `collections`：近期返回范围，无 Paging；不声称全部收藏历史。
- `contents`：支持 ContentType、Offset/Limit、SortField/SortOrder；限制每页最多 50，不额外造 Author/Favlists 字段。
- 四个收藏夹、十项收藏、四位示例作者、跨收藏夹共用文章、一作者多文章、同名不同作者、无作者条目及空收藏夹。数据与每个演示授权账号绑定，其他账号的收藏夹 ID 无效。
- 演示授权码及 Token 使用带类型、过期时间和签名的随机账号标识；授权码绑定 state，state 仍在数据库一次性消费并绑定 HttpOnly Cookie。Token 加密持久保存，浏览器只得到工作区会话。
- 缺 Token、过期、模式混用、非法分页/排序或未知收藏夹均失败，不回退开发者数据或真实网络请求。本地工作区尚未授权返回 ZHIHU_LOGIN_REQUIRED；已连接账号到期仍返回 ZHIHU_REAUTHORIZE，不能向首次使用者显示授权过期。
- 搜索、直答和 PDF 路径不能被该 mock 接管；演示 Token 不能向真实 API 外发。

## 本次验证与限制

`node --test server/durable/zhihu-oauth-mock.test.mjs server/durable/materials.test.mjs`：19 项通过，覆盖真实适配的原有回归和新增 10 项授权适配测试。API 测试使用 Fastify injection 与独立 PGlite，不是生产 PostgreSQL 或真实 OAuth 验收。

覆盖：同一路由登录/退出/会话、浏览器绑定、一次性 state、授权码交叉使用、过期、两个账号资源与收藏夹隔离、四类 API 字段与分页/排序、同名作者与多对多样例、密钥持久恢复、生产模式拒绝、演示令牌不外发、搜索/直答/PDF 不被 mock 替代。最后一次工作区快照运行 `npm test` 为 447/447，`npm run check` 与 `npm run build` 通过；包含主代理同时进行的其他改动，不能把全部测试记作本适配新增覆盖。构建仍有现存的大包警告。完整产品 UI 与新材料/作者网络的联调由主代理完成。

已有 Cookie 在有效期内恢复同一个工作区，服务端重启不会改账号。HTTP start 可把 identity.resolve 得到的 existingOwner 传给 login.start；不得读取客户端请求中的 owner。过期续接从该账号数据库密文回查并验证旧 Token 签名，复用原 subject，因此工作区和收藏夹 ID 均保留；无需新增公开 profile 字段。未登录/新浏览器才生成新演示账号。演示 Token 按正式样例一小时过期，需要重新授权，不伪造正式平台尚未提供的 refresh token。演示没有真实知乎登录/同意授权页面，也不验证官方 app 权限或风控。
