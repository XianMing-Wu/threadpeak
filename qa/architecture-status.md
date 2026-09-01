# Architecture status — Session ask-author fail-closed

- Time: 2026-09-01
- Commit: `04bb9f5`
- Environment: darwin, Node v25.5.0 (engines `>=24`), npm 11.8.0, Vite 8.2.2, TypeScript 6.0.3
- Maturity proposal: Session/划选问博主 gate = `implemented`; AskAuthorResolution / Zhihu-first live chain = still `prototype`

## Commands

| Command | Exit |
| --- | --- |
| `npm run check` | 0 |
| `npm run check:architecture` | 0 |
| `npm run check:contracts` | 0 (15 tests) |
| `npm run check:product-invariants` | 0 |
| `npm test` | 0 (110 tests) |
| `npm run build` | 0 |

## Browser / HTTP

- Vite `http://127.0.0.1:4301/` served `resolveAskAuthor` from Session and `useAnnotations`; `resolveBloggerReply` and the 720ms ready timer are gone
- Browser MCP was unreliable this slice; Session visual/ask-author click-through was not exercised in the user's live tab after the restart

## What this slice proves

- User-triggered Session composer 问博主 and selection annotations no longer render 马同学 / 李永乐老师 or write those names into the blogger network
- `useAnnotations.ts` shrank (timer removed); `store.ts` stayed at 626 lines

## What this slice does not prove

- No Zhihu-first search, AuthorEvidencePack, LLM review, or 刘看山 direct fallback
- Authors page search still uses local GraphRAG / example authors
- Route generate still depends on the lab API at `127.0.0.1:4312`
- No authors write-chain / schema copy
