# Compatibility: Auth landing OAuth gate

| 项 | 值 |
| --- | --- |
| Owner | `src/resolve-auth-session.ts` |
| 新路径 | `resolveAuthSession`：没有服务端 OAuth 时显式失败。进入本地原型仍可用，不得锁死整站 |
| 旧路径 | 授权按钮 `setTimeout(onAuthorize, 900)` 并显示「正在连接知乎」 |
| 删除条件 | 产品登录走服务端 OAuth/session；浏览器不得保存授权凭证 |

不复制路径或知识服务端 schema，也不新增 authors 写链。主题切换仍是本地壳控件。
