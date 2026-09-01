# Compatibility: concept learning entry

| 项 | 值 |
| --- | --- |
| Owner | `src/session/` |
| 新路径 | `resolveLearningEntry`：无 route/concept 或找不到路线时 fail-closed，不创建 conversation、不发明首段讲解 |
| 旧路径 | `readActiveRouteId() \|\| 'linear-algebra'` + `readActiveConceptId() \|\| 'linear-map'` + 定时 `syncKnowledgeWithFirstLesson` |
| 删除条件 | 产品 concept entry 走校验 handoff → canonical 首答 → graph bootstrap，且 Session 不再从 workspace 发明 lesson |

已选中的示例/我的路线仍走当前原型 lesson；本切片只禁止未选择时回退线性代数 fixture。不复制知识服务端 schema，也不新增 authors 写链。
