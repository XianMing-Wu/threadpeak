# Compatibility: ordinary chat answers

| 项 | 值 |
| --- | --- |
| Owner | `src/chat/` |
| 新路径 | `resolveOrdinaryAnswer`：没有真实 R5 provider 时显式失败。`resolveChatLaunch`：没有本次发送上下文时进入独立 404，不得预写「性价比高的显卡」或用 localStorage 正文冒充已打开会话。首页发送固定进入路线制定。 |
| 旧路径 | `DefaultAnswer` + `defaultAnswerMock`；`#chat` 缺 launch 时回退预写问题 |
| 删除条件 | 产品普通回答走服务端 AnswerPipeline；打开会话走 owner-scoped conversation GET |

不复制路径或知识服务端 schema，也不新增 authors 写链。
