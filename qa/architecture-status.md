# Architecture status — Chat route generate session

- Time: 2026-09-01
- Commit: `231d507`
- Environment: darwin, Node v25.5.0 (engines `>=24`), npm 11.8.0, Vite 8.2.2, TypeScript 6.0.3
- Maturity proposal: Chat route generate adapter = `implemented` against the existing JSON lab API; product PathStreamEvent / CAS session = still `prototype` / `uncontracted` in this Web repo; ordinary Chat answers and visuals remain `prototype`

## Commands

| Command | Exit |
| --- | --- |
| `npm run check` | 0 |
| `npm run check:architecture` | 0 |
| `npm run check:contracts` | 0 (15 tests) |
| `npm run check:product-invariants` | 0 |
| `npm test` | 0 (94 tests) |
| `npm run build` | 0 |

## Browser / HTTP

- `GET /` returned 200
- `POST /api/paths/generate` returned 502 (lab API on `:4312` is not running). That is an explicit failure, not a mocked path.
- Cursor browser MCP was unavailable this wake, so the Chat click path was verified by generate-session unit tests and the 502 proxy instead of a live UI pass.

## What this slice proves

- Product Chat route mode no longer uses page timers or `draftMineBlueprint` to invent a successful route
- `createMineRouteFromChat` requires a validated `learning-path` `1.0` document and keeps `knowledgeId: null`
- Transport failure does not publish a document or a mine route
- Follow-up chats do not regenerate; they only show the existing route intro

## What this slice does not prove

- No PathStreamEvent NDJSON, CAS session, or product path write chain
- No Web → real provider live gate for user-triggered product routes
- Path3D still has a fixture fallback for missing documents
- Ordinary answers and visual frames remain frontend mocks
