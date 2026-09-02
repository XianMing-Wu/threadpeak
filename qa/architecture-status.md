# Architecture status — GraphSurgeon bootstrap after canonical first answer

- Time: 2026-09-01
- Commits: `c77a47e` GraphSurgeon bootstrap; `c0b70a9` canonical first answer; `6a45de0` Zhihu OAuth; `ddd77b1` server/path
- Environment: darwin, Node 24+, Vite 8, TypeScript 6
- Maturity proposal:
  - `guard_status=verified` for Session/Chat/AskAuthor/AuthorSearch/Path document/stream cursor false-success closures
  - path generate `module_maturity=implemented` (in-process PathStreamEvent; not `integrated`)
  - identity OAuth `module_maturity=implemented` (authorization-code; not `integrated`)
  - GraphSurgeon bootstrap `module_maturity=implemented` (memory store, canonical gate, unique graph/root, A1 treated as 0 drafts); not `integrated` (no PostgreSQL unique/CAS, no A1 incremental, no committed conversation GET)
  - `module_maturity=prototype` for AnswerPipeline, author network projector

## Commands

| Command | Exit |
| --- | --- |
| `npm run check` | 0 |
| `npm run check:architecture` | 0 |
| `npm run check:contracts` | 0 (17 tests) |
| `npm run check:product-invariants` | 0 (10 tests) |
| `npm test` | 0 (181 tests) |
| `npm run build` | 0 |

## Live HTTP (`127.0.0.1:4312`)

- Accidental `5033` / Vite `5032` remaps reverted to `4312` / `4301`
- `GET /api/learning/graph?routeId=live-route&conceptId=live-concept` before canonical → 404 `missing`
- `POST /api/learning/graph` before canonical → 409 `CANONICAL_MISSING`
- `POST /api/learning/canonical-answer` first → 200 `reused=false`, `contentHash=56137d02…`, `evidenceCount=8`
- `POST /api/learning/graph` first → 200 `reused=false`, `revision=1`, `draftCount=0`, one `root`, same hash
- `POST /api/learning/graph` second → 200 `reused=true`, same `graphId` / hash / revision
- `POST /api/learning/canonical-answer` second → 200 `reused=true`, same hash (graph bootstrap did not regenerate the first answer)

## Browser

- `#session-learning` without route/concept fail-closes (no linear-algebra default)
- Mine concept entry reuses canonical first answer, then GraphSurgeon root; 知识脉络 shows structural root bound to the same hash
- Example `#knowledge-detail` canvas and example `#path-3d` still open
- `#path-3d` for a mine route without a validated document fail-closes and does not fall back to the demo path

## What this slice proves

- Graph/root is created only after a settled canonical first answer
- One graph, one root, bootstrap revision `+1`, concurrent reuse, zero A1 drafts still leave the root
- Pages do not `growGraph` for mine routes; canvas reads `GET /api/learning/graph`
- Product listen ports stay `4301` / `4312`

## What this slice does not prove

- Not PostgreSQL unique constraint / CAS / RLS
- Not GraphProjectionPipeline A1/A2/A3 incremental
- Not AnswerPipeline, committed conversation GET, or author-network projector
- Memory store is lost on process restart
