# Architecture status — engineering baseline

- Time: 2026-09-01
- Commit: pending (this slice)
- Environment: darwin, Node v25.5.0 (engines `>=24`), npm 11.8.0, Vite 8.2.2, TypeScript 6.0.3
- Maturity proposal: workspace/runtime-assets = `implemented`; product pages remain `prototype`

## Commands

| Command | Exit |
| --- | --- |
| `npm install` | 0 (132 packages, 0 vulnerabilities) |
| `npm run check` | 0 |
| `npm run check:architecture` | 0 (2 tests) |
| `npm run check:product-invariants` | 0 (5 tests) |
| `npm test` | 0 (70 tests) |
| `npm run build` | 0 |

## What this slice proves

- The app builds from this repository's lockfile. Scripts no longer invoke `../../zhihu_thread_chatbot/node_modules`.
- Icons, chart engines, 3D character GLBs, and the 3D host contract excerpt live under `src/vendor/`, `vendor/`, and `public/assets/`.
- `check:architecture` parses import specifiers and resolves local edges; sibling directory paths fail the gate.

## Browser / live evidence

- Vite `http://127.0.0.1:4301/` rendered the authenticated home shell with local icon sprite (MCP browser snapshot).
- Dev server served local assets with HTTP 200: `src/vendor/icons-v15.svg`, `vendor/charts/*`, `public/assets/liu-kanshan-idle.glb`.
- `.env` contains all five required keys. A one-off composition-root-style probe (not a product request) received DeepSeek `/v1/models` 200 and Zhihu origin 200. Secrets were not logged.
- Interactive hash-page walk was interrupted when the browser MCP session dropped after the home snapshot.

## What this slice does not prove

- No Web → API → real Zhihu/DeepSeek live gate for user-triggered path/answer/author commands.
- Path-lab still proxies `/api` to `127.0.0.1:4312`; that is a later path slice.
- Algorithm contracts remain at `../算法/` until the next slice.
- Fixture pages, localStorage truth, and fixed authors are unchanged.
- `format:check` / `lint` scripts are not in this slice.
