# ThreadPeak 审查修复与验收

执行日期：2026-09-08。基线 `main / 2b50e48`，结果对应本次未提交工作区。范围来自[原审查](project-audit-2026-09-08.md)：6 处确认缺陷及 8 组优化建议。原审查保留其历史结果，本页记录修复后的行为。

**F01–F06 已修复并加入实际入口回归；O1–O8 已落实下表中的工程改进。真实路线样本结构均通过，但内容审阅仍有未通过项，不能据此宣称产品已完成生产验收。** 本次没有提交、推送或部署，没有迁移或删除用户数据库，也没有修改私有 provider 配置。

## 1. 确认缺陷的修复

| 编号 | 当前行为与实现 | 回归证据 |
| --- | --- | --- |
| F01 | [R4 入口](../server/durable/tools.ts) 只接受严格阶段计划；删除新生成链的程序补路线、补引文和探索结果兜底。缺少目标、goalAlignment、真实材料引文等信息时，在同一 Agent、提示词和深度下最多尝试三次；耗尽后等待处理，保留输入，不发布路线。编译器只负责 ID、边及 renderer 转换。 | [真实 flow/store 测试](../server/durable/goal-agents.test.mjs) 覆盖空对象、非 JSON、旧图结构三次失败后无路线/文档，以及第二次修复成功；[严格计划测试](../server/path-generation/staged-plan.test.mjs) 覆盖字段、原话和引用。 |
| F02 | [provider adapter](../server/agent-runtime/llm-provider.ts) 的流式与非流式完成都要求非空正式 content 和完整结束信号；reasoning 不参与业务 JSON 提取。非空但不合 schema 的正式内容交回原 Agent 修复。 | [adapter 回归](../server/durable/durable.test.mjs) 覆盖 reasoning-only、截断与正常正式输出；[实际 adapter 接结构修复](../server/durable/audit-fixes.test.mjs) 验证畸形正式 JSON 仍进入有限修复。 |
| F03 | [资料 hook](../src/materials/use-materials.ts) 分离已选 ID、成功读取内容与待恢复项。失败保留 ID/收藏夹绑定，显示重试及显式移除入口，恢复完成前阻止发送。账号切换使旧恢复、上传和导入结果失效，未开始的旧账号上传不继续。 | [6 项资料恢复 UI 回归](../tests/ui/material-recovery.test.tsx)：全/部分失败、重试/移除、收藏夹、会话失败、恢复与上传中的账号切换。 |
| F04 | [共用 URL 身份函数](../server/agent-runtime/evidence-url.ts) 仅剔除已知追踪参数，保留决定文章身份的 query 与 hash 路由；两处搜索合并共用它。 | [URL 单测](../server/agent-runtime/evidence-url.test.mjs) 与实际 ProductTools 搜索/检查点回归，保留 `?id=alpha`、`?id=beta` 两篇证据。 |
| F05 | [共用作者问法打包](../server/agent-runtime/pack-search.ts) 在校验和发送中采用同一规则；A-card 与 N1 的每条上限均为 90 字，三问按前两条加第三条分两路发送。 | [实际作者 flow 回归](../server/durable/audit-fixes.test.mjs) 先拒绝 20/150/150 字，再接受修复后的 90/90/90 字；实际发送长度 181/90，第三问保留。 |
| F06 | [合同树校验](../packages/contracts/src/learning-v2.ts) 与[布局/文档排序](../src/learning-v2/tree.ts) 改为迭代遍历；基础布局与拖动偏移分离，文档采用平铺先序 DOM。新增页面错误边界提供恢复入口。 | [20,000 节点长链、环、布局和折叠测试](../src/learning-v2/tree.test.mjs)；浏览器检查 8 节点图的整棵子树拖动及图文切换。 |

旧审查目录中的复现脚本断言的是旧错误行为，不作为修复后的通过标准；本次替换了认可“兜底成功”和“reasoning 成功”的测试断言，没有用删除失败覆盖来掩盖回归。

## 2. 八组优化的落地与边界

| 建议 | 已落地 | 验证与仍有的边界 |
| --- | --- | --- |
| O1 Provider 预算 | [独立能力配置](../server/durable/capabilities.ts) 分开 LLM、知乎 fast/deep 的窗口及输出预留；移除按模型名称猜窗口；输入预算计入目标调用的 system 与输出。 | 混合大小窗口回归通过。生产要求显式配置六个能力字段；本地默认不是厂商能力声明，知乎输出字段用于预留，不能替不存在的 API 参数强制截断输出。 |
| O2 压缩 | 摘要缓存加入模型/服务、完整压缩策略和能力身份；同来源独立块最多两路并发，按原顺序汇合，失败时保留成功块检查点；记录字节、块、轮次、调用和缓存指标。 | 分块覆盖、原文不变、预算和恢复回归通过。真实长上下文仍有多次压缩；压缩保真与冷启动生产时延尚未整体验收。 |
| O3 清理 | 从 provider 请求路径移除到期记录 DELETE；既有维护流程每批至多清理 1,000 条到期缓存/调用记录，用 SKIP LOCKED 避免争抢，记录数量和耗时；添加全局时间索引。 | PGlite 与真实 PostgreSQL 验证热路径保留过期记录、维护有界；EXPLAIN 使用 `tp_provider_calls_created`。用户资料与无 TTL 摘要不在清理范围。 |
| O4 读取 | [目录 SQL 投影与游标分页](../server/durable/library.ts)，任务快照在 SQL 层排除输入和检查点；客户端收齐分页、按 ID 去重并保留账号隔离；作者网络一次建立节点、文章、段落来源索引。 | PostgreSQL 验证时间戳相同的分页、所有者隔离、快照一致性和隐藏正文；300 个目录测量见下表。作者网络未新增跨 revision 缓存，实际需要的学习来源仍会读取。 |
| O5 轮询与编辑 | 普通聊天使用 revision 条件读取；运行/空闲/隐藏分别约 1/5/30 秒，聚焦和本地修改唤醒；字段编辑仅传变动卡片，撤销历史保存字段差异，结构编辑保留结构信息。 | HTTP 回归保留三方合并、冲突、ID 与来源校验；UI 覆盖分页、唤醒、取消；撤销/重做不会直接覆盖并发新增节点。未采用最后写入覆盖。 |
| O6 前端资源 | 书架按尺寸复用几何、公共纹理及稳定书目印刷贴图；字体/内容身份变化时失效，删除闲置缓存，销毁时释放；跳过视口外行的更新。 | 浏览器中桌面 resize/主题变化保留 22 次印刷构建；重新进入仍为 22 本/11 几何/单 canvas。窄屏改变印刷尺寸时重建 22 张属于预期，不宣称任意 resize 零重建。未测生产瀑布、FPS、峰值内存，未新增全图/文档虚拟化，也未调高 bundle 告警阈值。 |
| O7 活跃合同 | [活跃 Agent 规格](../server/durable/agent-specs.ts) 明确当前 R1/R2/R3/R3b 及学习步骤，R4 保持独立严格入口；删除新生成链的旧计划 salvage。源码与 [Agent 文档](../docs/agents.md) 同步提示词、输出和预算。 | 5 类真实路线及后续 R4 复测已审阅；结构通过，内容质量部分不通过，见[内容账本](evidence/project-audit-fixes-2026-09-08/quality-review.md)。没有另加 judge 或程序编造内容。 |
| O8 可观测性 | 记录步骤缓存/执行/失败、任务年龄与耗时、提交、压缩、provider 排队与实际 usage；[运维聚合](../server/durable/ops-metrics.ts) 按阶段/服务统计 24 小时 P50/P95、失败及命中。检查点加入 prompt、能力和正式输出策略身份。 | 故障与未知 usage 回归通过；未提供 usage 时保持 null，不把字符估算当实际 token，不把嵌套步骤耗时相加。真实生产 SLO、长周期分布和收费金额仍需部署环境验证。 |

## 3. 本轮验证

环境：Node.js `v25.5.0`；离线测试使用 PGlite/受控 provider 边界；真实数据库使用独立临时 `threadpeak_test`、PostgreSQL 17 容器，不挂载用户数据。命令与输出保存在[验证账本](evidence/project-audit-fixes-2026-09-08/validation.json)。

| 命令 / 检查 | 结果与范围 |
| --- | --- |
| `npm run check` | 类型检查通过 |
| `npm run lint` | lint 通过 |
| `npm test` | 400 项 Node、52 项 UI 通过；包含实际 HTTP/store 链、架构及合同回归 |
| `npm run test:postgres` | 9 项通过；包含两个独立 HTTP 实例、进程重启、共享额度、租约/事务/MVCC及本轮投影/维护回归 |
| `npm run build` | 构建通过；书架和角色 chunk 仍触发既有体积提示，不代表首页同时加载它们 |
| `npm run check:docs` | 规则、链接、围栏、命令与结构检查通过 |
| 浏览器 | 1440×900、390×844 视口；22 本示例书、5 层书架、8 节点学习图；拖动、图文切换、编辑/撤销/重做和窄屏检查通过，采集时无 console error/warn |
| 真实 provider | 5 类路线完整生成链及 5 类 R4 单步复测均结构完成；内容审阅未全部通过。没有在本轮重跑首次学习、作者、OAuth 或 PDF 的真实 provider 全链路 |

[浏览器记录](evidence/project-audit-fixes-2026-09-08/browser.json)对应[桌面书架](evidence/project-audit-fixes-2026-09-08/shelf-desktop.png)、[窄屏书架](evidence/project-audit-fixes-2026-09-08/shelf-narrow.png)、[文档](evidence/project-audit-fixes-2026-09-08/document-desktop.png)、[画布](evidence/project-audit-fixes-2026-09-08/graph-desktop.png)。浏览器使用明确的独立 QA API 与示例副本；截图中的示例编辑在撤销后恢复，不能当作真实模型内容样本。

## 4. 合成性能测量

[原始测量与 EXPLAIN](evidence/project-audit-fixes-2026-09-08/benchmarks.json)由[基准脚本](../scripts/audit-repair-benchmark.mjs)在本机执行。以下为小样本分位数观测，不能充当生产 P95 或稳定性能承诺。

| 长链节点数 | 校验＋布局＋文档排序 P50 / P95（ms，5 次） | 全量字段编辑 / 单卡补丁（字节） |
| --- | --- | --- |
| 1,000 | 1.14 / 2.76 | 259,327 / 271 |
| 3,000 | 3.43 / 4.92 | 791,325 / 277 |
| 6,000 | 8.46 / 9.01 | 1,589,325 / 277 |
| 20,000 | 25.23 / 30.44 | 5,373,323 / 283 |

这里执行真实 Node 函数，不包含浏览器 DOM、布局绘制或 GPU 开销，不能据此声称 20,000 节点界面流畅。

| 同一所有者的 300 个合成聊天目录（每项 30,000 字符，9 次） | 载荷字节 | P50 / P95（ms） |
| --- | --- | --- |
| 旧式全资源读取 | 24,514,177 | 89.88 / 99.73 |
| 新 SQL 投影，读取全部三页 | 46,747 | 8.24 / 12.61 |

分页 EXPLAIN 使用 `tp_library_page`；全局调用时间扫描在 20,000 条合成调用记录上使用 `tp_provider_calls_created`。这些都是 localhost 数据库测量，不包含公网传输、真实账号分布、持续并发负载与冷存储。

## 5. 配置、升级与未关闭门槛

生产启动现在要求显式配置 `DEEPSEEK_CONTEXT_TOKENS`、`DEEPSEEK_MAX_OUTPUT_TOKENS`、`ZHIHU_FAST_CONTEXT_TOKENS`、`ZHIHU_FAST_OUTPUT_TOKENS`、`ZHIHU_DEEP_CONTEXT_TOKENS`、`ZHIHU_DEEP_OUTPUT_TOKENS`。取值须根据实际账号、模型与网关能力确认，见[配置指南](../docs/configuration.md)。本轮真实调用采用本地保守默认 LLM 64,000/16,384、知乎 fast/deep 32,000/8,192，未据此证明服务商窗口上限，也未改写私有 `.env`。

提示词、能力或输出策略发生变化时，受影响步骤使用新检查点键重新执行；未变化的检索和其他检查点继续复用，原记录不擦除。升级可能增加模型调用费用，已有待处理任务可能需要按[部署说明](../deploy/README.md)处理版本冲突；不能混跑不同合同版本的 worker。

未关闭的是生产及语义质量门槛：真实模型仍可能遗漏用户否定限制、重复教授已会知识、安排不当先后顺序或缺少事实成立条件，详见内容账本；生产身份、正式附件解析、摘要保真、备份恢复、持续负载及观测指标也未在本轮完成上线验收。上述缺口不能用结构拒绝机制、绿色离线测试或这次合成性能结果替代。
