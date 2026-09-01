# Compatibility: Settings identity and sources gate

| 项 | 值 |
| --- | --- |
| Owner | `src/resolve-settings-identity.ts` |
| 新路径 | `resolveSettingsIdentity` / `resolveSettingsSources`：没有真实 identity 或 committed source scope 时显式失败。密度、动效、思考深度仍是本地 UI 偏好 |
| 旧路径 | `#settings` 写死「吴贤明」为当前登录用户，并循环「知乎 · PDF / 已上传 PDF」冒充已生效资料范围 |
| 删除条件 | 产品设置读取服务端 OAuth/session 身份与 committed source/attachment scope；页面不得发明用户或上传成功 |

不复制路径或知识服务端 schema，也不新增 authors 写链。不得把 `threadpeak-authenticated` fail-close 成整站锁死。
