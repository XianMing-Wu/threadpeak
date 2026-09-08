# 开发指南

先按[快速开始](../README.md#快速开始)安装依赖并启动 API、前端。项目要求 Node 24+；依赖版本由 package-lock.json 固定。环境变量说明见[配置指南](configuration.md)。

## 目录职责

| 目录 | 内容 |
| --- | --- |
| `src/learning-v2` | 当前学习工作区、作者界面、客户端请求与快照 |
| `src/path-planning`、`src/path-3d` | 路线访谈与 3D renderer 宿主 |
| `src/lib` | Markdown、代码和公式阅读 |
| `server/durable` | API、任务、数据库、身份、资料与固定工作流 |
| `server/agent-runtime` | 当前模型/知乎适配器、预算与输出校验 |
| `packages/contracts` | 对外数据合同和校验 |
| `packages/api-client`、`packages/runtime-store` | 客户端传输与可复用状态原语 |
| `tests`、各模块的测试文件 | 行为、组件和架构回归 |
| `qa` | 独立验收页面、来源账本与已执行证据 |
| `design/route-covers` | 封面原图、生成记录与本地预览；不是重复的缓存 |
| `public/art/covers` | 产品实际加载的优化封面 |
| `src/vendor`、`vendor` | 第三方代码/运行时、来源、许可证与完整摘要清单 |

## 日常检查

```sh
npm run check
npm run lint
npm test
npm run build
```

`check` 覆盖主项目、组件测试和阅读 QA 页的 TypeScript；`lint` 同时检查业务代码、测试与维护脚本。`npm test` 同时运行 Node 行为测试和前端组合测试；部分组件通过真正的 Fastify 路由、worker、PGlite，只在 provider 边界使用替身。

```sh
npm run test:durable              # 持久任务回归
npm run check:contracts           # 公开合同
npm run check:architecture        # 导入边界与 vendor 摘要
npm run check:docs                # 文档链接、规则与配置说明
npm run check:product-invariants  # 产品行为
npm run test:coverage             # Node 与前端分别统计
```

前端覆盖率目录为 `coverage/frontend`，统计全部非 vendor 的前端源文件；Node 的数字只覆盖它加载并匹配统计范围的 TypeScript。二者不能相互替代，测试总数也不是功能覆盖率。

### 测试放在哪里

| 位置 | 验证边界 |
| --- | --- |
| 模块旁的 `*.test.mjs` | 模块行为、错误分支及本地集成；由 Node test runner 执行 |
| `tests/*.test.mjs` | 跨模块合同、导入边界、真实生产模式 HTTP 鉴权与文档结构 |
| `tests/ui/*.test.tsx` | React 交互、账号备份及组件与真实 HTTP/store 的组合；由 Vitest/jsdom 执行 |
| `tests/fixtures` | 明确的合成输入和 provider 边界替身，不进入产品数据 |
| `server/durable/postgres.gate.mjs` | 需独立真实 PostgreSQL 的驱动与多进程验证，不混入默认离线测试 |
| `qa/` | 真浏览器的布局、焦点、交互与人工来源审阅；jsdom 不能证明这些视觉行为 |

新测试放在负责该行为的模块旁；跨域回归放 `tests/`。修缺陷先保留可复现输入，断言用户或调用方能观察到的结果。文档门禁只检查结构、链接、规则覆盖和命令；它不证明产品行为，也不要求 README 复制 Agent 提示词。

## PostgreSQL

先创建独立的 `threadpeak_test` 库，再从进程环境传入连接：

```sh
TEST_DATABASE_URL='postgres://USER:PASSWORD@localhost:5432/threadpeak_test' npm run test:postgres
```

这会写入合成任务和资源，不用于正式库。gate 覆盖真实连接竞争、三进程额度共享、事务、取消、停机交回、无锁一致快照和共享 HTTP 计数。未运行此命令时，只能报告 PGlite 的结果。

## QA 与维护脚本

可视化页面及具体操作见 [qa/README.md](../qa/README.md)。下列脚本不随应用启动自动运行：

| 脚本 | 用途与前提 |
| --- | --- |
| `evaluate-goal-agents.mjs` | 使用真实 provider 评估目标访谈/学习；会产生服务调用与费用 |
| `evaluate-goal-answer.mjs` | 复用本地已保存检索材料，重新评估讲解 |
| `summarize-goal-evaluation.mjs` | 从本地 raw 输出整理精简样本 |
| `research-showcase.mjs` | 搜索示例候选；真实服务调用，不自动替换已审阅来源 |
| `build-showcase-sources.mjs` | 按明确选中位置构建来源与审阅账本，重搜后需要重新审阅 |
| `verify-showcase-browser.mjs` | 浏览器检查编选示例；需要单独提供 Playwright 模块路径 |
| `serve-goal-ui-qa.mjs` | 独立测试 provider 服务，用于访谈交互回归 |
| `generate-brand-outlines.py` | 手动重建固定品牌字形，按记录的字体版本下载并验证摘要 |

所有脚本均从仓库根目录运行。真实调用脚本与离线测试分开，私有原始响应保存在被忽略的 `qa/evidence/*/raw`，不加入 Git。使用者须提供各脚本要求的配置/本地依赖；不把这些手动工具算作应用启动依赖。

## 修改约定

- 先读 [AGENTS.md](../AGENTS.md) 和匹配的 Cursor Rules。产品说明与 Agent 合同分别拥有目标和提示词，README 只作入口。
- API 与前端共用公开合同；不从兄弟项目或私有路径导入。生成结果先校验再提交，错误不回退为示例。
- 修改阅读处理时补最小输入回归并运行[阅读验收页](../qa/reading-lab.html)；修改 vendor 时遵守[同步流程](../vendor/SOURCE.md)，不直接改生成 bundle。
- `dist`、`coverage`、`*.tsbuildinfo` 是可重新生成的产物；不要把 `.env`、数据目录、草稿备份或设计原图当缓存删除。
- 历史报告不再复制到根目录；当前指南直接更新，阶段证据存入 QA，旧叙述通过[历史索引](history.md)查阅。
