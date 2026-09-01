# Architecture status — mine-route first-lesson fail-closed

- Time: 2026-09-01
- Commit: `dad6e28`
- Environment: darwin, Node v25.5.0 (engines `>=24`), npm 11.8.0, Vite 8.2.2, TypeScript 6.0.3
- Maturity proposal: mine-route missing-canonical-answer gate = `implemented`; example catalog lesson / growGraph / canonical AnswerPipeline = still `prototype`; no knowledge production write chain

## Commands

| Command | Exit |
| --- | --- |
| `npm run check` | 0 |
| `npm run check:architecture` | 0 |
| `npm run check:contracts` | 0 (15 tests) |
| `npm run check:product-invariants` | 0 |
| `npm test` | 0 (103 tests) |
| `npm run build` | 0 |

## Browser / HTTP

- `GET /` returned 200
- Home hash `#home` rendered the signed-in shell
- Browser CDP was unavailable for injecting a mine route; empty-canonical fail-closed is covered by `resolveFirstLesson` tests

## What this slice proves

- Selected mine routes do not call `draftFirstLesson` or create a knowledge graph
- `syncKnowledgeWithFirstLesson` is read-only and only returns marked example catalog lessons
- `store.ts` shrank (675 → 626 lines) by deleting the mine write path

## What this slice does not prove

- No canonical initial answer, handoff validation, or GraphSurgeon
- `migrateKnowledge` can still rewrite dirty local graphs with `draftFirstLesson`
- Example Session still uses prototype catalog lesson + growGraph
- No authors write-chain change
