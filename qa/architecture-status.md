# Architecture status — path generation R1–R4

- Time: 2026-09-02
- Slice: `server/path-generation` + Chat/Home/3D/list handoff. Old CandidateSet stream remains prototype.
- Environment: darwin, Node 24+, Vite 8, TypeScript 6
- Maturity proposal:
  - path generation `module_maturity=implemented` for R1/R-S/R2/R3/R3b/R4, 3D projection, publish-without-knowledge
  - live Zhihu + DeepSeek path run `integrated` for this isolated orchestrator
  - first-answer / follow-up / ask-author / author-search remain `prototype` on the old chain
  - persistence, cancel/timeout/refresh, 3D last-position schema, chip copy remain `unresolved`

## Commands

| Command | Exit |
| --- | --- |
| `npm run check` | 0 |
| `npm run test:path-generation` | 0 (8 tests) |
| `npm run test:path-generation:live` | 0 (1 test, real Zhihu + DeepSeek) |

## Live gate

- R1 → parallel Zhihu search → R2 → R3 questions → select → R4 → renderer document
- `knowledgeCreated=false`
- R5 after publish returns non-empty text
- Retry from R1 does not keep the previous published document

## What this slice proves

- Product Chat uses `/api/path-runs`, not the CandidateSet stream
- Attachments are visible to R1/R2/R3/R4
- Superseded question sets remain; only the active set is answerable
- 3D return goes to the path list; empty list selects 路线制定 without sending
- Composer stays on the route Chat; thinking menu is 快速/深度
- path-lab is removed from the product Vite build

## What this slice does not prove

- Not L0a/L0b first-answer + unique root
- Not G1/G2, A1–A3, or N0–N2
- Not ordinary Chat history/retry contract beyond R5 after a published path
- Not PostgreSQL persistence or 3D last-position fields
