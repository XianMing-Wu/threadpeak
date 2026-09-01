# Architecture status — Shell account identity fail-closed

- Time: 2026-09-01
- Commit: `81fc2ad`
- Environment: darwin, Node v25.5.0 (engines `>=24`), npm 11.8.0, Vite 8.2.2, TypeScript 6.0.3
- Maturity proposal: Shell account identity gate = `implemented`; OAuth/session identity = still `prototype`

## Commands

| Command | Exit |
| --- | --- |
| `npm run check` | 0 |
| `npm run check:architecture` | 0 |
| `npm run check:contracts` | 0 (15 tests) |
| `npm run check:product-invariants` | 0 |
| `npm test` | 0 (123 tests) |
| `npm run build` | 0 |

## Browser / HTTP

- Dev Vite `http://127.0.0.1:4301/#home` at 1280×720
- Sidebar account control shows 「本地原型账号」, not 吴贤明
- Account menu still opens with 夜间模式 and 退出登录
- `#home` stays available; auth landing was not forced

## What this slice proves

- Shell no longer presents a hardcoded person as the signed-in account
- Theme and logout remain local shell controls
- `store.ts` stayed at 626 lines; no authors write-chain or path/knowledge schema copy

## What this slice does not prove

- No server OAuth/session or ActorContext
- Composer file chips and Home PDF scope remain local UI, not uploaded sources
- Isolated `data.ts` example-network fixtures may still contain the old name
