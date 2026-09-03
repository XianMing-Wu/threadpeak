# Architecture status — product pipelines except visual

- Time: 2026-09-02
- Slice: R1–R4 path-runs, R5 ordinary Chat, L0a/L0b first learning, G1/G2 follow-up, A1–A3 / N0–N2 authors. Visual generation remains fail-closed.
- Environment: darwin, Node 24+, Vite 8, TypeScript 6
- Maturity proposal:
  - path / first-learning / follow-up / authors / ordinary Chat `module_maturity=implemented` in-process
  - live Zhihu + DeepSeek gates exist per orchestrator
  - visual generation remains `unresolved`
  - persistence, cancel/timeout/refresh, 3D last-position field schema, chip copy, OAuth visible states remain `unresolved`

## What this slice proves

- Product Chat uses `/api/path-runs`; `/api/paths/generate` is gone
- Home ordinary send uses R5; empty Chat opens independent 404
- First concept entry uses L0a/L0b and settles the unique root in the same success
- Follow-up uses concurrent G1/G2; ask-authors is selection-only Zhihu-first
- Author search is network-first; Liu Kanshan is not an author
- Visual shortcut remains fail-closed
- path-lab and CandidateSet stream are removed from product source

## What this slice does not prove

- Not real visual generation
- Not PostgreSQL / cross-restart canonical persistence
- Not cancel / timeout / refresh recovery machines
- Not 3D last-position field morphology
