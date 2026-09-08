> 历史迁移备忘。原位置：`src/COMPOSER_COMPATIBILITY.md`。当前实现与目标以 [现状文档](../../../as-implemented-logic.md) 和 [Agent 合同](../../../agent-specs.md) 为准。

# Compatibility: Composer attachment and source-scope gate

| 项 | 值 |
| --- | --- |
| Owner | `src/resolve-composer-attachment.ts` |
| 新路径 | `resolveComposerAttachment` / `resolveComposerSources`：没有 committed attachment 或 source scope 时显式失败。不得用本地 file chip 或「你上传的文档」冒充成功 |
| 旧路径 | Home/Chat Composer 用隐藏 `input type="file"` 把文件名写成 chip，并用「知乎 · PDF」冒充已生效资料范围 |
| 删除条件 | 产品输入走 committed source/attachment scope；页面不得发明 evidence pack |

不复制路径或知识服务端 schema，也不新增 authors 写链。思考深度仍是本地 UI 偏好。
