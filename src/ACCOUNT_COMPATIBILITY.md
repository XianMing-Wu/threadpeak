# Compatibility: Shell account identity gate

| 项 | 值 |
| --- | --- |
| Owner | `src/resolve-account-identity.ts` |
| 新路径 | `resolveAccountIdentity`：没有真实服务端身份时，侧栏只标「本地原型账号」，菜单仍提供主题和退出。不得写死姓名 |
| 旧路径 | `WideShell` 把「吴贤明」渲染成当前登录用户 |
| 删除条件 | 产品壳读取服务端 OAuth/session 身份；账号控件不得发明用户 |

不复制路径或知识服务端 schema，也不新增 authors 写链。不得把 `threadpeak-authenticated` fail-close 成整站锁死。
