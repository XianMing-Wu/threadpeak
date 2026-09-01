# Architecture status — contract convergence

- Time: 2026-09-01
- Commit: `d04c669`
- Environment: darwin, Node v25.5.0 (engines `>=24`), npm 11.8.0, Vite 8.2.2, TypeScript 6.0.3
- Maturity proposal: `@threadpeak/contracts` shared runtime schema = `contracted`; product pages remain `prototype`

## Commands

| Command | Exit |
| --- | --- |
| `npm install` | 0 (workspace + zod) |
| `npm run check` | 0 |
| `npm run check:architecture` | 0 |
| `npm run check:contracts` | 0 (7 tests, both sides) |
| `npm run check:product-invariants` | 0 |
| `npm test` | 0 (77 tests) |
| `npm run build` | 0 |

## What this slice proves

- Unique physical definition of shared Uuid / Evidence / Envelope / OpenCode protocol lives in `packages/contracts`.
- `../算法/shared/runtime-contracts.ts` is a re-export only; golden fixtures parse identically and unknown keys fail on both sides.
- Compatibility deletion condition is written in the old file and `packages/contracts/COMPATIBILITY.md`.

## What this slice does not prove

- Path/knowledge domain schemas are still in `../算法/`; they were not silently copied or rewritten.
- No Web → API → real provider live gate for user-triggered commands.
- Knowledge still has a local `EvidenceRecordSchema` duplicate; it is not the unique owner and must not be treated as a second runtime definition.
