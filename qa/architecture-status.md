# Architecture status — path-lab transport

- Time: 2026-09-01
- Commit: pending (this slice)
- Environment: darwin, Node v25.5.0 (engines `>=24`), npm 11.8.0, Vite 8.2.2, TypeScript 6.0.3
- Maturity proposal: path-lab session adapter = `implemented` against the existing JSON lab API; product PathStreamEvent / CAS session = still `prototype` / `uncontracted` in this Web repo

## Commands

| Command | Exit |
| --- | --- |
| `npm run check` | 0 |
| `npm run check:architecture` | 0 |
| `npm run check:contracts` | 0 (15 tests) |
| `npm run check:product-invariants` | 0 |
| `npm test` | 0 (92 tests) |
| `npm run build` | 0 |

## Browser / HTTP

- `GET /path-lab.html` returned 200
- `POST /api/paths/generate` returned 502 (lab API on `:4312` is not running). That is an explicit failure, not a mocked path.
- Cursor browser MCP was unavailable this wake, so the generate click path was verified by session unit tests instead of a live UI pass.

## What this slice proves

- path-lab page no longer `fetch`es; composition injects fetch into `createApiClient.requestJson`
- RuntimeStore holds the lab session; quality-gate failure keeps the previous document
- Transport failure and `clarification_required` do not invent a renderer document
- Path/knowledge domain schemas were not copied into `packages/contracts`

## What this slice does not prove

- No PathStreamEvent NDJSON, CAS session, or product path write chain
- No Web → real provider live gate for user-triggered product routes
- Chat.tsx still uses page timers for the product route experience
