# 2026-09-09 首页三组示例验收

范围：六条完整目标，Agent 求职／明代历史／个人理财三组知识与路线，23 个概念。真实生成后整理为 139 块首次讲解、119 条按概念保存的引用来源记录及 8 张独立博主卡。来源摘要与原始生成响应分开保存。

## 真实调用

[流程记录](../../workflows.json)保存三条路线和全部概念的成功结果、调用次数及耗时；[来源账本](../../source-review.json)保存来源及博主卡摘要哈希；[本轮概念搜索](../../search-inventory-2026-09-09.json)保存实际查询与响应哈希。

三条路线分别耗时 95.022、69.703、45.827 秒（Agent 包含一次流式错误后的恢复；访谈为记录在案的示例人物回答）。逐概念首次学习、三个代表概念的问 AI 和问博主均使用真实服务。知乎并发不超过 2，发送间隔至少 2100ms，无直答。余额不足期间的失败原稿留在本机，充值后重跑完成；未完成状态不会进入展示目录。

## 离线和浏览器检查

- `npm run check`、`npm run lint`、`npm run build`、`npm run check:docs` 通过；构建仍提示较大的静态资源包。
- `npm test`：419 项 Node 测试、55 项 UI 测试通过。临时 API 测试需要允许监听本地端口。
- 23 个概念通过当前 LearningSchema、单父树、聊天／卡片一致性、引用来源与教学总结检查；三条路线通过当前 renderer 编译及 split／all-required join 验证。
- 六段 Python 代码完成语法检查；JSON 校验、有限重试和余弦相似度三个离线示例实际执行通过。HTTP 教学示例只核对语法，真实 API 验收由上述应用工作流完成。
- [浏览器报告](report.json)：实际 App、独立本地 API 数据库、独立 Chrome。六条建议逐条填入且不发送，首页三个知识／三个路线入口，23 个概念来源链接和节点数量，三条 WebGL 路线，390px 窄屏与聊天切换通过。报告保留每条路线的运行时 ready 快照及可见边。
- 初始测试浏览器关闭 GPU，无法启动 WebGL；改用独立软件 WebGL 环境验证。截图须等待运行时 ready、加载遮罩消失及绘制帧，不以 canvas 元素存在代替真实画面。

[Agent 并行路线](llm-application-parallel-route.png)、[明史并行路线](ming-history-parallel-route.png)、[理财并行路线](financial-decisions-parallel-route.png)、[首页示例](home-examples.png)、[手机对话](chat-mobile.png)。

浏览器脚本为 `scripts/verify-showcase-browser.mjs`，先启动隔离预览与开启远程调试的 Chrome，再设置 `SHOWCASE_URL`、`SHOWCASE_CDP_URL` 运行。生产账户、个人资料、咨询发送及部署不在本次范围内；固定示例通过不代表任意实时生成都达到相同教学质量。
