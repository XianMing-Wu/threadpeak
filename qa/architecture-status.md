# Architecture status — sidebar history reopen fail-closed

- Time: 2026-09-01
- Commit: `1cc9e0f`
- Environment: darwin, Node v25.5.0 (engines `>=24`), npm 11.8.0, Vite 8.2.2, TypeScript 6.0.3
- Maturity proposal: sidebar history reopen gate = `implemented`; ConversationUseCases / committed GET exact reopen = still `prototype`

## Commands

| Command | Exit |
| --- | --- |
| `npm run check` | 0 |
| `npm run check:architecture` | 0 |
| `npm run check:contracts` | 0 (15 tests) |
| `npm run check:product-invariants` | 0 |
| `npm test` | 0 (113 tests) |
| `npm run build` | 0 |

## Browser / HTTP

- Production preview `http://127.0.0.1:4302/#home` at 1280×720
- Clicking a seeded localStorage history title stays on `#home` and shows `role="alert"`「无法重开这次历史」
- Sidebar list is labeled 本地草稿; Shell no longer calls `hydrateLearningHistory` or navigates via `openChatHistory`
- Dev Vite on `4301` may still serve a stale module until that process is restarted

## What this slice proves

- Sidebar reopen no longer writes session route/concept keys or jumps to `#chat` / `#session-learning` as a committed restore
- `openChatHistory` only returns the unavailable resolution
- `store.ts` stayed at 626 lines; no authors write-chain or path/knowledge schema copy

## What this slice does not prove

- No owner-scoped conversation GET, exact reopen, or committed history projection
- Workspace localStorage still holds prototype conversation/route/knowledge drafts
- Route generate still depends on the lab API at `127.0.0.1:4312`
