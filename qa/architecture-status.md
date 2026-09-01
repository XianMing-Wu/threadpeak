# Architecture status — Session fail-closed entry

- Time: 2026-09-01
- Commit: `47a3ad0`
- Environment: darwin, Node v25.5.0 (engines `>=24`), npm 11.8.0, Vite 8.2.2, TypeScript 6.0.3
- Maturity proposal: Session missing-entry gate = `implemented`; selected-concept first lesson / growGraph / canonical answer = still `prototype`; no knowledge production write chain

## Commands

| Command | Exit |
| --- | --- |
| `npm run check` | 0 |
| `npm run check:architecture` | 0 |
| `npm run check:contracts` | 0 (15 tests) |
| `npm run check:product-invariants` | 0 |
| `npm test` | 0 (99 tests) |
| `npm run build` | 0 |

## Browser / HTTP

- `GET /` returned 200
- `#session-learning` with no active route/concept showed “无法进入这次学习” and did not invent a linear-algebra lesson
- Explicit `linear-algebra` + `linear-map` selection still opened the marked example lesson

## What this slice proves

- Session no longer defaults to `linear-algebra` / `linear-map`
- Missing route or concept does not create a conversation or invent a first lesson
- An explicitly selected example concept can still enter the current prototype lesson

## What this slice does not prove

- No canonical initial answer, handoff validation, or GraphSurgeon
- Selected mine routes still use `syncKnowledgeWithFirstLesson` / `draftFirstLesson`
- `openLearning` can still invent a concept via `defaultConceptId`
- No authors write-chain change
