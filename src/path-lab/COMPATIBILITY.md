# Compatibility: path-lab transport

| 项 | 值 |
| --- | --- |
| Owner | `src/path-lab/path-lab-session.ts` |
| 新路径 | `createApiClient.requestJson` + generate timeout → `parseGenerationResponse` / `projectSafeServiceFailure` → RuntimeStore selector；连接失败或超时显式失败，fetch 忽略 abort 时也不得停在 pending。Chat 卸载只 `abort()`，不得 `teardown()` 以免 StrictMode 把 store 冻死后一直停在 pending |
| 旧路径 | `App.tsx` 直接 `fetch('/api/paths/generate')` + `useState` |
| 删除条件 | 产品 path feature 使用 `PathStreamEvent` NDJSON 与 CAS session GET 恢复，且 path-lab 不再是页面内 JSON command |

实验台仍走现有 JSON 实验 API（Vite 代理到 `127.0.0.1:5033`）。本切片不把路径算法包的领域 schema 复制进 `packages/contracts`，也不把实验成功伪装成主产品 path 纵切完成。
