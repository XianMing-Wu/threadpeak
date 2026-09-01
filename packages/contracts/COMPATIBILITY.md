# Compatibility: shared runtime contracts

| 项 | 值 |
| --- | --- |
| Owner | `packages/contracts` |
| 新 schema | `@threadpeak/contracts` → `src/runtime-contracts.ts` |
| 旧 schema | `../算法/shared/runtime-contracts.ts`（仅 re-export） |
| 删除条件 | `路径生成` 与 `知识脉络` 都改为直接依赖 `@threadpeak/contracts`，且仓库内不再出现 `../算法/shared/runtime-contracts` 的生产 import |

这是等价搬迁，不是语义变更。路径/知识的领域 schema 仍在算法包内，本切片不把它们偷渡成第二套 runtime 定义。

`PublicError` / `StreamCursor` 是本仓库新增的跨进程 transport 原语，不是从算法包搬来的副本。PathStreamEvent 与 PublicSseEvent 仍由路径/知识 context 拥有。

路径包 `tsconfig.server.json` 增加了 `allowImportingTsExtensions`，只为跟踪本 re-export 的 `.ts` 入口；删除本兼容层时一并撤回。
