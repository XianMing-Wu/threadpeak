# Architecture status — Path3D validated document

- Time: 2026-09-01
- Commit: `71f087c`
- Environment: darwin, Node v25.5.0 (engines `>=24`), npm 11.8.0, Vite 8.2.2, TypeScript 6.0.3
- Maturity proposal: Path3D mine-route document host = `implemented` against locally persisted validated documents; PathStreamEvent / CAS snapshot / wire-id handoff = still `prototype` / `uncontracted`; example 3D routes remain marked example assets

## Commands

| Command | Exit |
| --- | --- |
| `npm run check` | 0 |
| `npm run check:architecture` | 0 |
| `npm run check:contracts` | 0 (15 tests) |
| `npm run check:product-invariants` | 0 |
| `npm test` | 0 (97 tests) |
| `npm run build` | 0 |

## Browser / HTTP

- `GET /` returned 200
- Cursor browser MCP was unavailable this wake. Document resolution was verified by `resolvePath3DView` unit tests instead of a live WebGL pass.

## What this slice proves

- `#path-3d` no longer defaults to `linear-algebra` or `threadPeakPathDocument` when a user route is missing
- Mine routes with an invalid document or an example fixture id fail closed
- Marked example routes can still render their example documents
- Opening 3D does not add a knowledge write chain

## What this slice does not prove

- No PathStreamEvent NDJSON, CAS session, or server handoff
- No wire-id → domain UUID mapping
- Session still defaults to `linear-algebra` when no active route is selected
- No Web → real provider live gate for user-triggered product routes
