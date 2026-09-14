# 验收页面与必要来源账本

这里保留可复用的浏览器验收页面，以及被测试、内容溯源实际使用的公开账本。运行方式见[开发指南](../docs/development.md)。截图、日志、Lighthouse、模型评估载荷和带日期的执行报告只保存在本机；已有版本通过[历史索引](../docs/history.md)回查。仓库中的页面和脚本存在，不表示当前版本已经通过相应验收。

## 独立验收页面

先启动 Vite，再打开相应地址。QA 页面不属于正式产品路由，也不进入应用构建入口。

| 页面 | 用途 |
| --- | --- |
| [path-lighting-lab.html](path-lighting-lab.html) | 真实 renderer 的 390/800/1200px 阴影尺寸切换与重复挂载 |
| [author-message-lab.html](author-message-lab.html) | 2026-09-09 公开搜索/模型样本的私聊编辑/复制，页面不发送消息 |
| [source-footprints.html](source-footprints.html) | 正式学习足迹组件、四种输入框的统一发送/停止，以及桌面/窄屏明暗状态 |
| [reading-lab.html](reading-lab.html) | 用真实阅读组件核对代码、公式、缺失提示和 320px 卡片 |
| [author-surface.html](author-surface.html) | 390px 真实 App 视口，检查作者目录、卡片与资料页面 |
| [visual-atlas.html](visual-atlas.html) | 390px 视口切换首页、作者、路线与已发布 WebP 封面目录 |
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

## 随仓库保留的来源

| 文件 | 用途与边界 |
| --- | --- |
| [示例流程](evidence/showcase/workflows.json) | 2026-09-13.2 版三条路线、每条前三个概念，共 9 个首次学习状态；真实流程执行与发布文本校对分开记录 |
| [示例来源审阅](evidence/showcase/source-review.json) | 同版 9 个概念的真实来源及原始/发布摘要哈希，供示例测试与维护；不是全文事实审校证明 |
| [私聊验收样本](evidence/author-review-2026-09-09.json) | 2026-09-09 公开搜索与 N2 样本，供 author-message-lab 使用；不代表当前模型新输出，也不发送私信 |
| [作者装饰出处](evidence/ux-ui-2026-09-08/author-hero/sources.json) | 12 张装饰卡的公开出处与资产哈希，不属于当前问题的作者推荐 |

真实 PostgreSQL、真实 provider、浏览器交互与内容质量分别验收。任何单项通过都不能代替其他门槛；样本不能作为真实请求失败时的成功兜底。新增执行记录放到被忽略的 `qa/evidence/` 子目录，只有确实被可复用测试或溯源依赖的最小公开资料才加入忽略规则白名单。不要提交凭证、私人输入、完整思考流或用户数据库。

## 复现来源与交互

目标评估脚本会调用实际服务，先按[配置指南](../docs/configuration.md)配置：

```sh
node scripts/evaluate-goal-agents.mjs paper-math collection finance minimal-3d llm-job --route-only
node scripts/evaluate-goal-agents.mjs paper-math minimal-3d --learning-only
node scripts/evaluate-goal-answer.mjs paper-math minimal-3d
node scripts/summarize-goal-evaluation.mjs
```

第三条复用前面保存的搜索与资料，并非重跑整个学习链。摘要保真、数学条件、实现版本、例子自洽性仍需要人工评估，结构校验只能证明格式和引用存在。

示例浏览器检查连接使用独立用户目录启动的 Chrome（`--remote-debugging-port=9332`），在新标签运行；预览 API 使用独立临时数据库，不操作真实用户资料：

```sh
SHOWCASE_CDP_URL=http://127.0.0.1:9332 SHOWCASE_URL=http://127.0.0.1:4399/ node scripts/verify-showcase-browser.mjs
```

示例原摘要和讲解的维护约定见[编选示例](../docs/showcase.md)。重新搜索会改变排序，必须重新审阅再打包来源。
