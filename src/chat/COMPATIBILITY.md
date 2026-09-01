# Compatibility: ordinary chat answers

| 项 | 值 |
| --- | --- |
| Owner | `src/chat/` |
| 新路径 | `resolveOrdinaryAnswer`：用户触发的普通回答在没有真实 Answer provider 时显式失败 |
| 旧路径 | `Chat.tsx` `DefaultAnswer` + `defaultAnswerMock` 预写成功正文 |
| 删除条件 | 产品普通回答走服务端 AnswerPipeline / 真实知乎与 LLM adapter，页面只读 committed artifact |

不复制路径或知识服务端 schema，也不新增 authors 写链。图文模式仍是独立 prototype。
