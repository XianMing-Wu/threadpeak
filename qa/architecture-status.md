# Architecture status — Chat ordinary-answer fail-closed

- Time: 2026-09-01
- Commit: `3e8a531`
- Environment: darwin, Node v25.5.0 (engines `>=24`), npm 11.8.0, Vite 8.2.2, TypeScript 6.0.3
- Maturity proposal: Chat ordinary-answer gate = `implemented`; AnswerPipeline / committed artifact / visual Chat = still `prototype`

## Commands

| Command | Exit |
| --- | --- |
| `npm run check` | 0 |
| `npm run check:architecture` | 0 |
| `npm run check:contracts` | 0 (15 tests) |
| `npm run check:product-invariants` | 0 |
| `npm test` | 0 (107 tests) |
| `npm run build` | 0 |

## Browser / HTTP

- Vite `http://127.0.0.1:4301/` served `OrdinaryAnswerUnavailable` and `resolveOrdinaryAnswer`; `defaultAnswerMock` is gone from Chat and catalog
- Browser MCP was unavailable after the previous tab hit `chrome-error://`; no end-to-end click-through on Home → Chat

## What this slice proves

- User-triggered ordinary Chat answers no longer render prewritten mock success
- `Chat.tsx` shrank (191 → 188 lines); `catalog.ts` dropped `defaultAnswerMock` (680 → 635)

## What this slice does not prove

- No AnswerPipeline, real Zhihu/LLM adapter, or committed answer artifact
- Chat visual mode still uses page timers and fixture frames
- Route generate is still lab JSON, not PathStreamEvent/CAS
- No authors write-chain change
