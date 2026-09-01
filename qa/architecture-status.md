# Architecture status — AuthLanding OAuth fail-closed

- Time: 2026-09-01
- Commit: `20ed1c4`
- Environment: darwin, Node v25.5.0 (engines `>=24`), npm 11.8.0, Vite 8.2.2, TypeScript 6.0.3
- Maturity proposal: AuthLanding OAuth gate = `implemented`; server OAuth/session = still `prototype`

## Commands

| Command | Exit |
| --- | --- |
| `npm run check` | 0 |
| `npm run check:architecture` | 0 |
| `npm run check:contracts` | 0 (15 tests) |
| `npm run check:product-invariants` | 0 |
| `npm test` | 0 (128 tests) |
| `npm run build` | 0 |

## Browser / HTTP

- Dev Vite `http://127.0.0.1:4301/` at 1280×720
- After logout, 知乎授权登录 shows `role="alert"`「无法完成知乎授权」
- No 900ms 「正在连接知乎」 success path
- 进入本地原型 still opens `#home`; the prototype is not locked behind auth

## What this slice proves

- Auth landing no longer treats a local timer plus `threadpeak-authenticated` as Zhihu OAuth success
- Theme toggle and prototype entry remain local shell controls
- `store.ts` stayed at 626 lines; no authors write-chain or path/knowledge schema copy

## What this slice does not prove

- No server OAuth/session, ActorContext, or token exchange
- Composer/source/attachment still have no committed upload pipeline
- Workspace `localStorage` drafts remain prototype conversation storage
