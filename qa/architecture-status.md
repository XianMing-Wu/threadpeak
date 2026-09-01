# Architecture status — Chat visual-answer fail-closed

- Time: 2026-09-01
- Commit: `b53208b`
- Environment: darwin, Node v25.5.0 (engines `>=24`), npm 11.8.0, Vite 8.2.2, TypeScript 6.0.3
- Maturity proposal: Chat/Session visual-answer gate = `implemented`; VisualizationArtifact / Surface Catalog / AnswerPipeline = still `prototype`

## Commands

| Command | Exit |
| --- | --- |
| `npm run check` | 0 |
| `npm run check:architecture` | 0 |
| `npm run check:contracts` | 0 (15 tests) |
| `npm run check:product-invariants` | 0 |
| `npm test` | 0 (109 tests) |
| `npm run build` | 0 |

## Browser / HTTP

- Vite `http://127.0.0.1:4301/` served `VisualAnswerUnavailable` and `resolveVisualAnswer`; Chat no longer contains `selectVisualFrames` or the 2600ms visual timer
- Session visual kind now calls `resolveVisualAnswer` instead of composing `VisualAnswer`
- Browser MCP was unavailable; Home `#home` dump-dom confirmed the SPA boots. Chat visual click-through was not exercised in a live tab

## What this slice proves

- User-triggered Chat/Session visual answers no longer render fixture mindmap/sunburst/timeline or page timers as success
- `Chat.tsx` shrank (188 → 105 lines); isolated visual engines remain in `src/visuals/` and must not be composed into user-request success

## What this slice does not prove

- No VisualizationArtifact, Surface Catalog, or committed visual attachment
- Route generate is still lab JSON, not PathStreamEvent/CAS
- Session ask-authors still presents fixed authors 马同学 / 李永乐老师
- No authors write-chain change
