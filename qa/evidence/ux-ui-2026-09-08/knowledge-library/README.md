# 知识脉络列表简化（2026-09-08）

本版已被用户后续要求的[统一书架页](../knowledge-bookshelf/README.md)替代。以下截图和检查结果只对应当时的双页图文列表；同名验证脚本现已更新为书架验收。

用户要求我的／示例知识脉络有自己的样式，同时明确纠正为「简化」。当前版本移除灯效、大封面、叠图、重复标签和多层面板，只保留标题、切换、搜索、小图文行与细分隔线。桌面两列，窄屏单列，使用项目已有字体、颜色、圆角和刘看山封面。两页共用组件，学习工作区、路线、首页、博主页的设计不在此次修改范围。

## 当前截图

- [桌面示例](example-1440.png)、[桌面个人空态](mine-1440.png)、[深色示例](example-dark-1440.png)。
- [390px 示例](example-390.png)、[390px 个人空态](mine-390.png)、[320px 示例](example-320.png)。
- [个人有内容](mine-populated-fixture.png)、[加载中](mine-loading-fixture.png)、[读取失败](mine-error-fixture.png)：仅浏览器路由拦截的测试数据，不写用户资料。

修改前的全站对照保存在 `before/`；其中 `knowledge-example.png` 因同页 hash 切换未更新组件状态，实际仍为个人页，不作为示例页的修改前证据。

## 验证范围与结果

[浏览器报告](report.json)记录 5 组交互检查、10 个页面状态审查：1440／390／320px 的 22 条示例、个人页隔离、关键词搜索、无结果和清空、无蓝色输入外轮廓、滚轮、末项键盘定位、Enter 打开原学习工作区，以及深色主题、个人有内容、加载、错误优先于搜索空态、重新连接和路线入口。没有横向溢出或页面脚本异常。axe 未发现 serious／critical 问题；共享 Shell 的 section 包含 main 仍有 moderate 级 `landmark-main-is-top-level` 提示，保留在报告中，未扩大此次视觉修改范围。

- [回归日志](test.log)：379 项 Node 测试、36 项 UI 测试通过。
- [Lint](lint.log)、[文档检查](docs.log)通过。
- [完整构建](build.log)及类型检查受工作区已有的 `server/path-generation/staged-plan.ts` 第 114、125 行 `string | false` 与 `boolean` 不匹配阻塞；此次没有修改该后端文件。[前端 Vite 打包](frontend-build.log)通过。
- 本地构建预览 Lighthouse：[桌面](lighthouse-desktop.json)性能／可访问性／最佳实践为 100／100／100；[移动端](lighthouse-mobile.json)为 86／100／100。测量对象为编选示例列表，不能代表所有页面或生产环境。

复现专项浏览器检查：

```sh
PLAYWRIGHT_MODULE=/path/to/playwright AXE_MODULE=/path/to/axe-core UX_QA_URL=http://127.0.0.1:4301/ node scripts/verify-knowledge-library.mjs
```

测试中的个人数据、加载和错误响应只存在于独立浏览器上下文；编选示例仍使用正式组件及现有数据。以上证据不涉及真实 provider、生产部署或生成质量。
