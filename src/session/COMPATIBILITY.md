# Compatibility: concept learning entry and ask-author gate

| 项 | 值 |
| --- | --- |
| Owner | `src/session/` |
| 新路径 | `requestFirstEntry`：L0a/L0b 与确定性唯一根同一 settle。画布只 `GET /api/learning/graph` 读已提交快照，不能单独 POST 建根。`resolveAskAuthor` / `resolveAuthorSearch` / `resolveAuthorNetwork`：没有真实 Zhihu-first / network-first 结果时显式失败 |
| 旧路径 | 画布对 mine 调用旧长图并写 localStorage；独立 graph bootstrap；固定作者与批注 timer；`#authors` 用本地 GraphRAG 和示例雷达冒充搜索或网络成功 |
| 删除条件 | 产品 concept entry 走 L0 同一成功态；问博主走服务端 AskAuthorResolution；博主搜索走 N0–N2；博主网络走 committed relationship projection |

已选中的示例路线仍可读标记 catalog lesson。我的路线在没有 canonical 首答时显式失败，不能用页面发明根。不复制路径或知识服务端 schema。
