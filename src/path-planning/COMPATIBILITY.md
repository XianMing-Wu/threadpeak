# Compatibility: Chat route planning

| 项 | 值 |
| --- | --- |
| Owner | `src/path-planning/` |
| 新路径 | `createPathGenerateSession`（现 re-export path-lab session）→ api-client JSON generate → RuntimeStore → ChatRoutePanel selectors → `mineRouteFromValidatedDocument` |
| 旧路径 | `Chat.tsx` `setTimeout` 阶段机 + `draftMineBlueprint` 关键词拼路线 |
| 删除条件 | 产品 path feature 使用 PathStreamEvent NDJSON / CAS session GET 恢复，且 Chat 不再 import path-lab JSON contracts |

`createMineRouteFromChat` 只接受已校验 `LearningPathDocument`，`knowledgeId` 仍为 `null`。缺服务或质量门禁失败必须显式报错，不能再降级成 Mock 路线。path-planning 依赖 path-lab session 是临时倒置，产品 CAS 接通后删除本兼容层。
