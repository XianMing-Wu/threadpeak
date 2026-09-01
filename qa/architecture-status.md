# Architecture status — Chat launch fail-closed

- Time: 2026-09-01
- Commit: `df262ad`
- Environment: darwin, Node v25.5.0 (engines `>=24`), npm 11.8.0, Vite 8.2.2, TypeScript 6.0.3
- Maturity proposal: Chat launch gate = `implemented`; owner-scoped conversation GET = still `prototype`

## Commands

| Command | Exit |
| --- | --- |
| `npm run check` | 0 |
| `npm run check:architecture` | 0 |
| `npm run check:contracts` | 0 (15 tests) |
| `npm run check:product-invariants` | 0 |
| `npm test` | 0 (131 tests) |
| `npm run build` | 0 |

## Browser / HTTP

- Dev Vite `http://127.0.0.1:4301/#chat` at 1280×720
- Empty `#chat` (no `threadpeak-chat-launch`) shows `role="alert"`「无法打开这次对话」
- No prewritten 「性价比高的显卡有哪些？」
- Home text send still opens `#chat` with the user query; ordinary answer remains fail-closed

## What this slice proves

- Chat no longer invents a conversation query when send context is missing
- Home still writes a local draft handoff for the current send
- `store.ts` stayed at 626 lines; no authors write-chain or path/knowledge schema copy

## What this slice does not prove

- No owner-scoped conversation GET or exact reopen
- Workspace `localStorage` drafts remain prototype storage
- Ordinary/visual/route success still needs real providers
