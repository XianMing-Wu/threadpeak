# Architecture status — Composer attachment and sources fail-closed

- Time: 2026-09-01
- Commit: `b14172a`
- Environment: darwin, Node v25.5.0 (engines `>=24`), npm 11.8.0, Vite 8.2.2, TypeScript 6.0.3
- Maturity proposal: Composer attachment/sources gate = `implemented`; committed source/attachment scope = still `prototype`

## Commands

| Command | Exit |
| --- | --- |
| `npm run check` | 0 |
| `npm run check:architecture` | 0 |
| `npm run check:contracts` | 0 (15 tests) |
| `npm run check:product-invariants` | 0 |
| `npm test` | 0 (126 tests) |
| `npm run build` | 0 |

## Browser / HTTP

- Dev Vite `http://127.0.0.1:4301/#home` at 1280×720
- Home 添加附件 shows `role="alert"`「无法添加附件」; no file chip or `input type="file"`
- Text-only send still opens `#chat`; follow-up 添加附件 also fail-closes
- Home keeps `showScope={false}`; `#home` stays available and is not locked behind auth

## What this slice proves

- Composer no longer presents a local filename or 「你上传的文档」 as an uploaded source
- Thinking depth remains a local preference
- `store.ts` stayed at 626 lines; no authors write-chain or path/knowledge schema copy

## What this slice does not prove

- No committed source/attachment scope, evidence pack, or upload pipeline
- Chat ordinary/visual/route still need real providers for success
- Workspace `localStorage` drafts remain prototype conversation storage
