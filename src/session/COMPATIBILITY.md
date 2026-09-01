# Compatibility: concept learning entry

| 项 | 值 |
| --- | --- |
| Owner | `src/session/` |
| 新路径 | `resolveLearningEntry` + `resolveOpenLearningTarget` + `resolveFirstLesson` + `resolveKnowledgeMigration`：无 route/concept 时 fail-closed；我的路线不发明 lesson/图；workspace 读取也不用 `draftFirstLesson` 改写 mine |
| 旧路径 | `defaultConceptId` + `syncKnowledgeWithFirstLesson`/`migrateKnowledge` 对 mine 调用 `draftFromRoute` + `draftFirstLesson` |
| 删除条件 | 产品 concept entry 走校验 handoff → canonical 首答 → graph bootstrap，且 Session 不再从 workspace 发明 lesson |

已选中的示例路线仍可读标记 catalog lesson。我的路线在没有 canonical 首答时显式失败。不复制知识服务端 schema，也不新增 authors 写链。
