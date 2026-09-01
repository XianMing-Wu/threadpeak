# Architecture status — Settings identity and sources fail-closed

- Time: 2026-09-01
- Commit: `600d163`
- Environment: darwin, Node v25.5.0 (engines `>=24`), npm 11.8.0, Vite 8.2.2, TypeScript 6.0.3
- Maturity proposal: Settings identity/sources gate = `implemented`; OAuth/session identity and committed source scope = still `prototype`

## Commands

| Command | Exit |
| --- | --- |
| `npm run check` | 0 |
| `npm run check:architecture` | 0 |
| `npm run check:contracts` | 0 (15 tests) |
| `npm run check:product-invariants` | 0 |
| `npm test` | 0 (122 tests) |
| `npm run build` | 0 |

## Browser / HTTP

- Dev Vite `http://127.0.0.1:4301/#settings` at 1280×720
- Two `role="alert"` blocks: 「无法显示登录身份」and 「无法设置资料范围」
- Settings page no longer shows 吴贤明 or a 知乎 · PDF / 已上传 PDF cycle
- Density and thinking-depth controls remain as local preferences
- `#home` still opens; `threadpeak-authenticated` was not fail-closed into a locked auth landing

## What this slice proves

- Settings no longer presents a hardcoded person or uploaded-PDF scope as committed identity/sources
- Prototype login unlock stays available so the rest of the app can be used
- `store.ts` stayed at 626 lines; no authors write-chain or path/knowledge schema copy

## What this slice does not prove

- No server OAuth/session, ActorContext, or committed source/attachment scope
- Shell sidebar still shows a prototype account label outside Settings
- Composer file chips and Home PDF scope remain local UI, not uploaded sources
