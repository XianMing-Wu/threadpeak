> 历史迁移备忘。原位置：`src/runtime/COMPATIBILITY.md`。当前实现与目标以 [现状文档](../../../as-implemented-logic.md) 和 [Agent 合同](../../../agent-specs.md) 为准。

# Compatibility: prototype library read model

| 项 | 值 |
| --- | --- |
| Owner | `packages/runtime-store` + `src/runtime/` |
| 新读取路径 | `hydrateFromGet` → RuntimeStore snapshot → selector → Home/Collections |
| 旧读取路径 | `useWorkspaceTick` + `listKnowledge` / `listRoutes` / `recommendedExample*` |
| 删除条件 | 路线/知识列表改为 owner-scoped GET 的 committed projection，且这些页面不再 import `workspace/store` 作为读模型 |

`projectLibraryReadModel` 仍从原型 `workspace/store` 投影卡片。这不是服务端事实源，也不能把 localStorage 晋升为生产真相。
