# Architecture status — Authors network fail-closed

- Time: 2026-09-01
- Commit: `b3bf4b5`
- Environment: darwin, Node v25.5.0 (engines `>=24`), npm 11.8.0, Vite 8.2.2, TypeScript 6.0.3
- Maturity proposal: `#authors` network gate = `implemented`; author-network projector / committed relationship live chain = still `prototype`

## Commands

| Command | Exit |
| --- | --- |
| `npm run check` | 0 |
| `npm run check:architecture` | 0 |
| `npm run check:contracts` | 0 (15 tests) |
| `npm run check:product-invariants` | 0 |
| `npm test` | 0 (112 tests) |
| `npm run build` | 0 |

## Browser / HTTP

- Production preview `http://127.0.0.1:4302/#authors` at 1280×720: 「博主网络」shows `role="alert"`「无法打开这次博主网络」
- No `.author-network-graph`, no 马同学 / 李永乐老师
- Isolated `author-network.ts` / `AuthorNetworkGraph` remain but are not composed into the page
- Dev Vite on `4301` may still serve a stale module until that process is restarted

## What this slice proves

- User-facing `#authors` network no longer reads sessionStorage or seeds example constellation authors as a committed network
- Page mount no longer calls `hydrateNetworkFromAnnotations`
- `store.ts` stayed at 626 lines; no authors write-chain or path/knowledge schema copy

## What this slice does not prove

- No committed `AuthorRelationshipSignal`, owner-scoped projector, or live network snapshot
- Ask-author / search / network live Zhihu + DeepSeek chains are still absent
- Route generate still depends on the lab API at `127.0.0.1:4312`
