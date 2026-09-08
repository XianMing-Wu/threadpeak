> 历史迁移备忘。原位置：`src/path-planning/COMPATIBILITY.md`。当前实现与目标以 [现状文档](../../../as-implemented-logic.md) 和 [Agent 合同](../../../agent-specs.md) 为准。

# Compatibility: Chat path-runs

| 项 | 值 |
| --- | --- |
| Owner | `src/path-planning/` |
| 新路径 | `startPathRun` → `/api/path-runs` R1–R4 → `ChatRoutePanel` → `createMineRouteFromChat` |
| 旧路径 | path-lab CandidateSet stream / `/api/paths/generate` |
| 删除条件 | 旧实验页和 CandidateSet 接口已从产品源码删除 |

`createMineRouteFromChat` 只接受已校验 `LearningPathDocument`，`knowledgeId` 仍为 `null`。缺服务或校验失败必须显式报错，不能降级成 Mock 路线。
