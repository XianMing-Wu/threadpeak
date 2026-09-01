# Architecture status — Authors search fail-closed

- Time: 2026-09-01
- Commit: `5e509a7`
- Environment: darwin, Node v25.5.0 (engines `>=24`), npm 11.8.0, Vite 8.2.2, TypeScript 6.0.3
- Maturity proposal: `#authors` search gate = `implemented`; AuthorSearchPipeline / network-first live chain = still `prototype`

## Commands

| Command | Exit |
| --- | --- |
| `npm run check` | 0 |
| `npm run check:architecture` | 0 |
| `npm run check:contracts` | 0 (15 tests) |
| `npm run check:product-invariants` | 0 |
| `npm test` | 0 (111 tests) |
| `npm run build` | 0 |

## Browser / HTTP

- Production preview `http://127.0.0.1:4302/#authors` at 1280×720: idle search form has no ranking or 马同学 / 李永乐老师
- Submitting a query shows `role="alert"`「无法完成本次博主搜索」and the GraphRAG/fixed-author message; no scan count and no top-3
- 「博主网络」tab still renders the existing network pane/graph
- Dev Vite on `4301` was still serving the previous Authors module at verify time; use a hard refresh after that process is restarted

## What this slice proves

- User-triggered `#authors` search no longer composes `runAuthorGraphRag` or example radar authors into a successful result
- Isolated GraphRAG helpers remain in `author-graph-rag.ts` and are not a user-request success path
- `store.ts` stayed at 626 lines; no authors write-chain or path/knowledge schema copy

## What this slice does not prove

- No owner-scoped network-first search, Zhihu fallback, LLM review, or committed `AuthorSearchResult`
- Authors network still uses sessionStorage / example constellation as a visual prototype
- Route generate still depends on the lab API at `127.0.0.1:4312`
