# 验收与来源证据

这里保留能复现的 QA 页面、明确时间/范围的执行证据，以及编选来源账本。日常测试入口见[开发指南](../docs/development.md)，历史界面和旧版本报告见[历史索引](../docs/history.md)。

## 独立验收页面

先启动 Vite，再打开相应地址。QA 页面不属于正式产品路由，也不进入应用构建入口。

| 页面 | 用途 |
| --- | --- |
| [reading-lab.html](reading-lab.html) | 用真实阅读组件核对代码、公式、缺失提示和 320px 卡片 |
| [author-surface.html](author-surface.html) | 390px 真实 App 视口，检查作者目录、卡片与资料页面 |
| [visual-atlas.html](visual-atlas.html) | 390px 视口切换首页、作者、路线与封面原图目录 |
| [ux-ui-lab.html](ux-ui-lab.html) | 真实作者关系图的独立合成资料，验证键盘、焦点、缩放和减少动效 |
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
| [架构验证](evidence/architecture-review/validation.json) | 2026-09-07 第三轮：371 项 Node、17 项 UI、7 项真实 PostgreSQL；旁存命令输出。这是该版本结果，不是永久测试基线 |
| [目标样本](evidence/goal-agents/samples.json) | 2026-09-07 合成目标情境的真实 provider 样本；含路线与讲解，仍有质量边界 |
| [搜索清单](evidence/showcase/search-inventory.json) | 2026-09-07 的 24 个真实知乎查询、120 条候选记录 |
| [来源审阅](evidence/showcase/source-review.json) | 22 个示例概念的取舍、来源 ID 和摘要哈希；不是作者背书或全文事实审校 |
| [示例浏览器报告](evidence/showcase/browser/report.json) | 2026-09-07 浏览器逐概念、路线与窄屏验收，截图与报告对应当时版本 |
| [UX/UI 优化验收](evidence/ux-ui-2026-09-08/README.md) | 2026-09-08 样式体系、明暗主题、响应式和键盘交互；命令、浏览器结果及范围分别记录 |

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

示例浏览器检查使用独立上下文，不操作真实用户资料：

```sh
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright SHOWCASE_URL=http://127.0.0.1:4301/ node scripts/verify-showcase-browser.mjs
```

示例原摘要和讲解的维护约定见[编选示例](../docs/showcase.md)。重新搜索会改变排序，必须重新审阅再打包来源。
