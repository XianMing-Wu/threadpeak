# Compatibility: concept learning entry and ask-author gate

| 项 | 值 |
| --- | --- |
| Owner | `src/session/` |
| 新路径 | `resolveGraphMutation`：我的路线不发明 lesson/图/conversation 节点；KnowledgeCanvas 也不对 mine `growGraph` 或 persist。`resolveAskAuthor`：没有真实 Zhihu-first AskAuthorResolution 时显式失败 |
| 旧路径 | `syncConversationGraph` + 画布 `saveKnowledgeGraph` 对 mine 调用 `growGraph` 并写 localStorage；`resolveBloggerReply` 固定作者与 720ms 批注 timer |
| 删除条件 | 产品 concept entry 走校验 handoff → canonical 首答 → graph bootstrap；问博主走服务端 AskAuthorResolution，页面只读 committed 1–2 位或刘看山直达 |

已选中的示例路线仍可读标记 catalog lesson。我的路线在没有 canonical 首答时显式失败。不复制路径或知识服务端 schema，也不新增 authors 写链。
