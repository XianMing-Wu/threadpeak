# Compatibility: sidebar history reopen gate

| 项 | 值 |
| --- | --- |
| Owner | `src/history.ts` / `src/resolve-history-reopen.ts` |
| 新路径 | `resolveHistoryReopen`：没有真实 owner-scoped conversation GET 时显式失败。侧栏列表只标为本地草稿 |
| 旧路径 | `openChatHistory` 写 session key 并跳转 `#chat` / `#session-learning`；Shell 启动时 `hydrateLearningHistory` |
| 删除条件 | 产品 history 走 ConversationUseCases + committed GET/exact reopen；页面只读已提交 snapshot |

不复制路径或知识服务端 schema，也不新增 authors 写链。
