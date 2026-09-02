# Architecture status — in-repo path stream and live fail-closed audit

- Time: 2026-09-02
- Commits: `ddd77b1` server/path six files, plus Chat PathStreamEvent client
- Environment: darwin, Node 24+, Vite 8, TypeScript 6
- Maturity proposal:
  - `guard_status=verified` for Session/Chat/AskAuthor/AuthorSearch/Path document/stream cursor false-success closures
  - path generate `module_maturity=implemented` for in-process PathStreamEvent composition; not `integrated` (no PostgreSQL/CAS, live generateCandidates can still fail closed)
  - `module_maturity=prototype` for AnswerPipeline, GraphSurgeon, author network projector

## Commands

| Command | Exit |
| --- | --- |
| `npm run check` | 0 |
| `npm run check:architecture` | 0 |
| `npm run check:contracts` | 0 (16 tests) |
| `npm run check:product-invariants` | 0 (10 tests) |
| `npm test` | 0 (154 tests) |
| `npm run build` | 0 |

## Live HTTP

- `GET /ready` → 200, `ready=true`
- `POST /api/paths/generate` without `PATH_GENERATE_UPSTREAM` → 503 `providers_unavailable`
- `POST /api/authors/search` → 503 `NETWORK_UNAVAILABLE` (network projector missing; no Zhihu fallback)
- `POST /api/answers` → 200 `completed`, `evidenceCount=8` via Zhihu search + DeepSeek
- `POST /api/ask-author` → 200 `direct` 刘看山 fallback; Liu is not an author identity

## What this slice proves

- Server composition reads `.env` for Zhihu + DeepSeek; missing config fails `/ready`
- Session/Chat ordinary answers no longer write linear-algebra `coachReply` or authors/visual success sentinels into the knowledge graph
- Generate + Path3D share one renderer document validator that rejects incomplete `flowGroup`s
- Decoder accepts aggregate/path session ids; RuntimeStore first event is sequence 1; NDJSON can emit incrementally
- Concept must belong to the route; conversation graph keeps nodes without `conversationId`; canvas drafts stay on the matching concept conversation
- Old 「马同学」 annotations are rejected; AskAuthor failures are not persisted as ready replies
- Architecture gate now checks cycles, browser→server, deep package imports, and Vite provider keys
- PRODUCT_SPEC / Authors copy no longer present undecided network topology or “route creates knowledge” as product fact

## What this slice does not prove

- No committed conversation/graph GET, CAS snapshot, or live Zhihu/DeepSeek gate with production telemetry
- AuthorSearch still fail-closes when the network projector is missing; that is required by network-first
- Path generate on 4312 now hosts in-repo `server/path` PathStreamEvent; live generateCandidates can still fail closed as `PROVIDER_UNAVAILABLE`
- Memory session store is not PostgreSQL/CAS crash recovery
- `PRODUCT_SPEC`, state machines, and remaining algorithm packages live outside this git root
