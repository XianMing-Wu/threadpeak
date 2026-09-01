# Compatibility: ordinary and visual chat answers

| 项 | 值 |
| --- | --- |
| Owner | `src/chat/` |
| 新路径 | `resolveOrdinaryAnswer` / `resolveVisualAnswer`：没有真实 Answer / Visualization provider 时显式失败 |
| 旧路径 | `DefaultAnswer` + `defaultAnswerMock`；`VisualAnswer` 页面 timer 与 fixture frames |
| 删除条件 | 产品普通/图文回答走服务端 AnswerPipeline，页面只读 committed artifact / VisualizationArtifact |

不复制路径或知识服务端 schema，也不新增 authors 写链。
