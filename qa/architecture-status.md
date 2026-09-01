# Architecture status — Chat route generate timeout fail-closed

- Time: 2026-09-01
- Commit: `8d2a06b`
- Environment: darwin, Node v25.5.0 (engines `>=24`), npm 11.8.0, Vite 8.2.2, TypeScript 6.0.3
- Maturity proposal: Chat / path-lab generate timeout gate = `implemented`; PathStreamEvent / CAS session = still `prototype`

## Commands

| Command | Exit |
| --- | --- |
| `npm run check` | 0 |
| `npm run check:architecture` | 0 |
| `npm run check:contracts` | 0 (15 tests) |
| `npm run check:product-invariants` | 0 |
| `npm test` | 0 (119 tests) |
| `npm run build` | 0 |

## Browser / HTTP

- Dev Vite `http://127.0.0.1:4301/#home` at 1280×720 with lab API `4312` down
- Home → 路线制定 → `给我制定一条机器学习数学路线` → `#chat`
- `#chat` shows `role="alert"`「无法发布这条路线」and does not stay on「正在判断目标是否需要校准」
- Proxy unavailability surfaced as HTTP 502; hanging fetch is covered by the 10s generate timeout even when `fetch` ignores abort
- Chat unmount uses `abort()` rather than `teardown()`, so StrictMode cleanup cannot freeze the store on pending

## What this slice proves

- Unreachable or hung `/api/paths/generate` no longer looks like a succeeding path
- User abort still leaves the cancelled state; timeout abort is an explicit error
- `store.ts` stayed at 626 lines; no authors write-chain or path/knowledge schema copy

## What this slice does not prove

- No PathStreamEvent NDJSON, CAS session, or live generate against a running `4312` lab
- The 10s budget is the lab JSON adapter wait, not a production generate SLA
- Workspace localStorage still holds prototype conversation/route/knowledge drafts
