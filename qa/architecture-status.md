# Architecture status — transport and RuntimeStore

- Time: 2026-09-01
- Commit: `db0349a`
- Environment: darwin, Node v25.5.0 (engines `>=24`), npm 11.8.0, Vite 8.2.2, TypeScript 6.0.3
- Maturity proposal: `@threadpeak/contracts` transport primitives = `contracted`; `@threadpeak/api-client` decoder/transport = `implemented` (no product endpoints); `@threadpeak/runtime-store` = `implemented`; Home/list selector consumption = `prototype` (still projected from workspace localStorage)

## Commands

| Command | Exit |
| --- | --- |
| `npm install` | 0 (workspace packages) |
| `npm run check` | 0 |
| `npm run check:architecture` | 0 |
| `npm run check:contracts` | 0 (15 tests) |
| `npm run check:product-invariants` | 0 |
| `npm test` | 0 (88 tests) |
| `npm run build` | 0 |

## Browser

- `#home` shows selector-backed recommended example knowledge and routes
- `#knowledge` mine empty, example cards render after tab switch
- `#paths` mine empty, example cards render after tab switch

## What this slice proves

- Unique PublicError / StreamCursor / stream meta live in `packages/contracts`
- api-client decodes NDJSON and SSE separately, fail-closed on unknown version, and never invents fetch success
- RuntimeStore keeps immutable snapshots, ignores duplicate/late events, fail-closes on sequence gaps, and teardown stops writes
- Home and route/knowledge list pages read through selectors

## What this slice does not prove

- No Web → API → real provider live gate
- List projections still come from prototype `workspace/store`
- PathStreamEvent / PublicSseEvent domain payloads were not copied
- Chat, Session, history, and 3D still use page-local or workspace truth
