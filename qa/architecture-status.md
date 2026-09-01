# Architecture status — openLearning fail-closed concept

- Time: 2026-09-01
- Commit: `6168d2d`
- Environment: darwin, Node v25.5.0 (engines `>=24`), npm 11.8.0, Vite 8.2.2, TypeScript 6.0.3
- Maturity proposal: openLearning missing-concept gate = `implemented`; selected-concept first lesson / growGraph / canonical answer = still `prototype`; no knowledge production write chain

## Commands

| Command | Exit |
| --- | --- |
| `npm run check` | 0 |
| `npm run check:architecture` | 0 |
| `npm run check:contracts` | 0 (15 tests) |
| `npm run check:product-invariants` | 0 |
| `npm test` | 0 (100 tests) |
| `npm run build` | 0 |

## Browser / HTTP

- `GET /` returned 200
- Browser MCP was unavailable this slice; fail-closed empty concept is covered by `resolveOpenLearningTarget` + Session entry tests
- Explicit `linear-algebra` + `linear-map` remains a valid selected example, not a default

## What this slice proves

- `openLearning` no longer fills the first blueprint concept via `defaultConceptId`
- Empty or whitespace concept is stored as missing and Session fail-closes
- `openKnowledgeFromSession` does not invent a concept either
- `store.ts` lost `defaultConceptId` and shrank (680 → 675 lines)

## What this slice does not prove

- No canonical initial answer, handoff validation, or GraphSurgeon
- Selected mine routes still use `syncKnowledgeWithFirstLesson` / `draftFirstLesson`
- No authors write-chain change
- Path3D still uses hash/sessionStorage handoff, not CAS / wire-id
