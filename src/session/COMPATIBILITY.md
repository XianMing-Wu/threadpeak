# Compatibility: concept learning entry

| 项 | 值 |
| --- | --- |
| Owner | `src/session/` |
| 新路径 | `resolveLearningEntry` + `resolveOpenLearningTarget` + `resolveFirstLesson`：无 route/concept 时 fail-closed；`openLearning` 不发明概念；我的路线无 canonical 首答时不发明 lesson、不建图 |
| 旧路径 | `readActiveRouteId() \|\| 'linear-algebra'` + `defaultConceptId` + `syncKnowledgeWithFirstLesson` 对 mine 调用 `draftFirstLesson` 并写 knowledge |
| 删除条件 | 产品 concept entry 走校验 handoff → canonical 首答 → graph bootstrap，且 Session 不再从 workspace 发明 lesson |

已选中的示例路线仍可读标记 catalog lesson。我的路线在没有 canonical 首答时显式失败。不复制知识服务端 schema，也不新增 authors 写链。
