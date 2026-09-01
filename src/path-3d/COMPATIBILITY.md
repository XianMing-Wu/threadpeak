# Compatibility: Path3D document host

| 项 | 值 |
| --- | --- |
| Owner | `src/path-3d/` |
| 新路径 | `resolvePath3DView` → 已校验 LearningPath 1.0 document → `LearningPath3DView` |
| 旧路径 | `readActiveRouteId() \|\| 'linear-algebra'` + `routeDocument() ?? threadPeakPathDocument` |
| 删除条件 | 产品 3D 从 CAS `PublishedPathSnapshot` GET 恢复 document，并完成 wire-id → domain UUID handoff |

用户路线缺文档或文档是示例 fixture 时必须显式失败，不能回退到内置演示路径。示例路线仍可渲染明确标记的示例 document。打开 3D 不写 knowledge。
