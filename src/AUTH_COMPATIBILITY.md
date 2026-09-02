# Compatibility: Auth landing OAuth gate

| 项 | 值 |
| --- | --- |
| Owner | `server/identity/` + `src/runtime/request-auth-session.ts` |
| 新路径 | 服务端按 [知乎 OAuth 应用集成](https://developer.zhihu.com/docs) 做 Authorization Code Flow：`openapi.zhihu.com/authorize` → `authorization_code` 回调 → 后端 `POST openapi.zhihu.com/access_token`。浏览器只拿 opaque session cookie。缺 `ZHIHU_OAUTH_*` 时授权按钮显式失败。进入本地原型仍可用 |
| 旧路径 | 授权按钮 `setTimeout(onAuthorize, 900)` 并显示「正在连接知乎」 |
| 删除条件 | 产品登录走服务端 OAuth/session；浏览器不得保存 `app_key` 或 `access_token`。官方文档补全「获取用户信息」字段后，再投影公开身份，不得编造姓名 |

Access Secret（`ZHIHU_ACCESS_SECRET`）只用于开放平台数据 API，不能当作第三方登录，也不能发给浏览器用户。
