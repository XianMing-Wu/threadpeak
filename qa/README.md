# 验收与来源证据

- 2026-09-13 登录重设计（本地记录 `login-redesign-2026-09-13.md`，不随仓库发布）：12 个实际登录界面参考、产品介绍风格衔接、视口内布局与登录状态验收。

- 2026-09-13 产品介绍接入（本地记录 `introduction-integration-2026-09-13.md`，不随仓库发布）：同源构建、根页与登录跳转、稳定态滚动、目标输入，以及学习到真人请教的连贯演示。

- 2026-09-12 蓝色圆台漂移修复（本地记录 `path-card-drift-2026-09-12.md`，不随仓库发布）：相机偏移符号、真实投影回归及点击后静置验证。

- 2026-09-12 作者头像修复（本地记录 `author-avatar-2026-09-12.md`，不随仓库发布）：回答短长链接识别、旧缓存更新、真实图片与上游未命中边界。

这里保留能复现的 QA 页面、明确时间/范围的执行证据，以及编选来源账本。日常测试入口见[开发指南](../docs/development.md)，历史界面和旧版本报告见[历史索引](../docs/history.md)。

- 2026-09-12 知乎 OAuth 接入（本地记录 `oauth-integration-2026-09-12.md`，不随仓库发布）：官方 uid 合同、回调安全、过期重连、真实授权页及待用户确认的联调边界。

- [2026-09-09 路线光照与作者审查](path-author-audit-2026-09-09.md)：尺寸变化复现、证据流、真实 N2 与私聊草稿验收。

- [2026-09-09 阅读渲染审查](reading-audit-2026-09-09.md)：求导缺式、Markdown 结构、真实公式讲解与黑色输入按钮。

- [2026-09-09 登录页与游客会话](guest-login-2026-09-09.md)：双入口、授权资料隐藏、游客恢复与录屏参考背景。

- [2026-09-09 登录页视觉重设计](login-design-2026-09-09.md)：全幅球体背景、中文字体、浮层尺寸稳定与多屏宽验收。

- [2026-09-10 Grok 两份报告逐项复核](grok-review-resolution-2026-09-10.md)：79 个编号条目及附加意见的判断、修复、拒绝理由和本轮验证。

## 独立验收页面

先启动 Vite，再打开相应地址。QA 页面不属于正式产品路由，也不进入应用构建入口。

| 页面 | 用途 |
| --- | --- |
| login-responsive.html（本地记录 `login-responsive.html`，不随仓库发布） | 真实登录应用的桌面与窄屏几何检查 |
| login-states.html（本地记录 `login-states.html`，不随仓库发布） | 真实 AuthLanding 的等待与失败回调，不创建会话 |
| introduction-motion.html（本地记录 `introduction-motion.html`，不随仓库发布） | 介绍页的学习、足迹、请教、结尾分镜与稳定状态检查 |
| introduction-responsive.html（本地记录 `introduction-responsive.html`，不随仓库发布） | 390 × 844 真实介绍 iframe，核对长文案与按钮边界 |
| [path-lighting-lab.html](path-lighting-lab.html) | 真实 renderer 的 390/800/1200px 阴影尺寸切换与重复挂载 |
| [author-message-lab.html](author-message-lab.html) | 真实公开搜索与模型样本的私聊编辑/复制，页面不发送消息 |
| [source-footprints.html](source-footprints.html) | 正式学习足迹组件、四种输入框的统一发送/停止，以及桌面/窄屏明暗状态 |
| [reading-lab.html](reading-lab.html) | 用真实阅读组件核对代码、公式、缺失提示和 320px 卡片 |
| [author-surface.html](author-surface.html) | 390px 真实 App 视口，检查作者目录、卡片与资料页面 |
| [visual-atlas.html](visual-atlas.html) | 390px 视口切换首页、作者、路线与封面原图目录 |
| [ux-ui-lab.html](ux-ui-lab.html) | 真实作者关系图的独立合成资料，验证键盘、焦点、缩放和减少动效 |
| [review-regressions.html](review-regressions.html) | 合成卡片的等待继续、成功收起、焦点恢复与隐藏画布 DOM 验收 |
| [learning-actions-lab.html](learning-actions-lab.html) | 真实文章作者入口与浮动问博主输入，验证窄屏、失败保留和成功接收 |
| [account-storage-review.html](account-storage-review.html) | 用合成草稿填满真实浏览器容量，验证账号隔离和恢复 |
| [account-recovery-review.html](account-recovery-review.html) | 登录接口不可用时，验证重新打开真实 App 后仍发现持久备份 |

账号存储页只用于独立 localhost 测试源，有既存账号或备份时拒绝覆盖。离线恢复页将 API 代理指向未监听端口后运行，例如：

```sh
THREADPEAK_API_TARGET=http://127.0.0.1:54428 npm run dev -- --port 54429 --strictPort
```

打开 `http://127.0.0.1:54429/qa/account-recovery-review.html`，准备合成备份 → 进入真实应用 → 关闭并重新打开 → 核对备份 → 清理本测试记录。预期出现恢复提示与导出按钮；页面核对的是导出数据，浏览器下载动作另行验收。

## 离线访谈交互

`serve-goal-ui-qa.mjs` 运行真实 HTTP、worker 和内存数据库，只把模型/搜索替换为明确的测试输入，专用于检查三个建议、自定义回答、自动发布及刷新。需要生成质量或真实搜索时使用正式 API。

```sh
# 终端一：独立测试 API，固定 4412
node scripts/serve-goal-ui-qa.mjs
```

```sh
# 终端二：独立浏览器源，固定 4404
THREADPEAK_API_TARGET=http://127.0.0.1:4412 npm run dev -- --port 4404 --strictPort
```

打开 `http://localhost:4404`。仅使用合成目标；数据随测试 API 进程结束而丢弃。这一过程不能作为真实 provider 验收。

## 保留的证据

| 目录 / 文件 | 时间与范围 |
| --- | --- |
| [学习足迹与输入操作](source-ux-2026-09-09.md) | 2026-09-09，截图真实关系回查、资料/讲解身份区分、统一发送停止与窄屏交互验收 |
| [搜索规划误拦截修复](search-reliability-2026-09-09.md) | 2026-09-09，真实失败任务原因、R1/R3 语义误判修复、同任务恢复与完整 HTTP 路线验证 |
| [审查修复与验收](project-audit-fixes-2026-09-08.md) | 2026-09-08，修复 F01–F06、落实 O1–O8 的工程改进；离线回归、真实 PostgreSQL、浏览器、合成性能测量与真实路线内容审阅分别记录，尚不代表生产验收 |
| [前端、后端与 AI 后端审查](project-audit-2026-09-08.md) | 2026-09-08，基于 `2b50e48`：6 处已复现问题、8 组优化建议与命令账本；业务修复和真实 provider/生产验收另行进行 |
| [架构验证](evidence/architecture-review/validation.json) | 2026-09-07 第三轮：371 项 Node、17 项 UI、7 项真实 PostgreSQL；旁存命令输出。这是该版本结果，不是永久测试基线 |
| [目标样本](evidence/goal-agents/samples.json) | 2026-09-07 合成目标情境的真实 provider 样本；含路线与讲解，仍有质量边界 |
| [搜索清单](evidence/showcase/search-inventory.json) | 2026-09-07 的 24 个真实知乎查询、120 条候选记录 |
| [真实示例流程](evidence/showcase/workflows.json) | 2026-09-09 三条路线、23 个概念首次学习及三组追问；最终内容另经人工审阅 |
| [本轮示例搜索](evidence/showcase/search-inventory-2026-09-09.json) | 2026-09-09 逐概念真实搜索的查询与响应哈希 |
| [来源审阅](evidence/showcase/source-review.json) | 2026-09-09，23 个概念的来源及 8 张博主卡；摘要哈希保留原文，不是全文事实审校 |
| [本轮示例验收](evidence/showcase/browser/2026-09-09/README.md) | 2026-09-09 六条目标、三个并行路线、23 个概念和手机宽度；真实调用与固定内容验收分开记录 |
| [示例浏览器报告](evidence/showcase/browser/report.json) | 2026-09-07 浏览器逐概念、路线与窄屏验收，截图与报告对应当时版本 |
| [UX/UI 优化验收](evidence/ux-ui-2026-09-08/README.md) | 2026-09-08 样式体系、明暗主题、响应式和键盘交互；命令、浏览器结果及范围分别记录 |
| [学习发送与知乎调用验收](evidence/learning-actions-2026-09-08/README.md) | 2026-09-08 真实任务恢复、三路直答、发送反馈、作者入口与身份边界 |

2026-09-07 第三轮前端行覆盖率为 25.70%；画布编辑、作者全部交互、移动端操作尚未完整覆盖。真实 PostgreSQL 和真实 provider 是不同验收；其中任何一项通过，都不证明正式 OAuth、生产负载或教学事实全部正确。

原始 provider 输入/响应只留在本机 `raw/` 并被 Git 忽略。精简样本和搜索来源用于复现及内容溯源，不得作为真实请求失败时的成功兜底。

## 复现来源与交互

目标评估脚本会调用实际服务，先按[配置指南](../docs/configuration.md)配置：

```sh
node scripts/evaluate-goal-agents.mjs paper-math collection finance minimal-3d llm-job --route-only
node scripts/evaluate-goal-agents.mjs paper-math minimal-3d --learning-only
node scripts/evaluate-goal-answer.mjs paper-math minimal-3d
node scripts/summarize-goal-evaluation.mjs
```

第三条复用前面保存的搜索和直答，并非重跑整个学习链。摘要保真、数学条件、实现版本、例子自洽性仍需要人工评估，结构校验只能证明格式和引用存在。

示例浏览器检查连接使用独立用户目录启动的 Chrome（`--remote-debugging-port=9332`），在新标签运行；预览 API 使用独立临时数据库，不操作真实用户资料：

```sh
SHOWCASE_CDP_URL=http://127.0.0.1:9332 SHOWCASE_URL=http://127.0.0.1:4399/ node scripts/verify-showcase-browser.mjs
```

示例原摘要和讲解的维护约定见[编选示例](../docs/showcase.md)。重新搜索会改变排序，必须重新审阅再打包来源。
