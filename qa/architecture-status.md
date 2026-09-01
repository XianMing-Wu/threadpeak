# Architecture status — Session prepare-theater, thinking-menu stacking, Path3D remount

- Time: 2026-09-01
- Commit: `2831aee`
- Environment: darwin, Node v25.5.0 (engines `>=24`), npm 11.8.0, Vite 8.2.2, TypeScript 6.0.3
- Maturity proposal: Session entry theater removal, Home thinking-menu stacking, and Path3D remount-on-id = `implemented`; PathStreamEvent/CAS, canonical first answer, and live Zhihu/DeepSeek = still `prototype`

## Commands

| Command | Exit |
| --- | --- |
| `npm run check` | 0 |
| `npm run check:architecture` | 0 |
| `npm run check:contracts` | 0 (15 tests) |
| `npm run check:product-invariants` | 0 |
| `npm test` | 0 (133 tests) |
| `npm run build` | 0 |

## Browser / HTTP

- Dev Vite `http://127.0.0.1:4301` at 1280×720
- Home thinking menu (`z-index: 2`) sits above `.home-discovery` (`z-index: 0`); hover hits menu buttons, not suggestion chips
- Home recommended example route 「批判性思维：从观点到论证」 opens `#path-3d` with a WebGL canvas and no 「3D 路线运行失败」 overlay
- `#session-learning` without a selection still fail-closes; selected example lessons render immediately without 「正在准备当前学习内容」

## What this slice proves

- Session no longer uses an 1800ms preparing theater
- Composer isolation no longer lets the suggestion marquee paint through the thinking menu
- Path3D remounts on document id, not parent callback/object identity, so sidebar collapse does not dispose an in-flight runtime
- `store.ts` stayed at 626 lines

## What this slice does not prove

- No PathStreamEvent/CAS snapshot or wire-id handoff
- No live Zhihu/DeepSeek providers
- WebGL still depends on the host browser; this is not a non-3D concept fallback
- Input-motion WIP remains uncommitted and is not part of this slice
