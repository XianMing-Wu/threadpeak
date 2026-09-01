# ThreadPeak 浏览器验收截图

截图由本地 Vite 运行时在 1280×720 视口生成，不是设计稿或静态拼图。`current/` 保存本轮通过 TypeScript、测试、构建和状态机验证后的关键页面/交互状态。

| 文件 | 验收点 |
| --- | --- |
| [`01-home.png`](current/01-home.png) | 220px 问山侧栏、口号、路线/图文双模式、712px Composer、推荐知识脉络与问题建议 |
| [`02-paths.png`](current/02-paths.png) | 工具轨、我的/示例路线切换与路线卡 |
| [`03-knowledge.png`](current/03-knowledge.png) | 我的/示例知识脉络切换与最终概念卡 |
| [`04-knowledge-edge.png`](current/04-knowledge-edge.png) | thread-chatbot 风格只读树、分支数字和原因浮层 |
| [`05-authors.png`](current/05-authors.png) | 找博主雷达初始态；无预置问题、博主和概念，中心直接显示大问题输入 |
| [`06-settings-dialog.png`](current/06-settings-dialog.png) | 知乎式设置页与清空本地历史模态框 |
| [`07-session-visual.png`](current/07-session-visual.png) | 来源栏、统一会话、图文模式可交互逻辑图与 Composer |
| [`08-path-3d.png`](current/08-path-3d.png) | 真实 WebGL 运行时、无锁载体主线、刘看山与动态概念桥 |
| [`09-path-3d-concept-card.png`](current/09-path-3d-concept-card.png) | 最终概念卡，DOM 仅有一个“进入学习”按钮 |
| [`10-authors-focus.png`](current/10-authors-focus.png) | 雷达扫描完成后动态生成的概念、博主分布、多标签外环、前三推荐与精简咨询卡片 |

## 同轮自动证据

- `npm run check`：通过。
- `npm test`：12/12 通过。
- `npm run build`：通过；仅有 Vite 大 chunk 性能提示。
- `threadpeak-state-machines/npm run validate`：60 个 Markdown、61 张 Mermaid、42 项源码证据、88 个可见 JSX 按钮、8 个页面，全部通过。

性能提示来自真实 3D/GLB 运行时的 bundle 体积，不影响本轮功能与视觉验收；生产拆包应在后续工程化阶段处理。
