# Architecture status — shared agent runtime (context, budget, compression, validation)

- Time: 2026-09-02
- Slice: `server/agent-runtime` only. Product HTTP still uses the prototype live-service / path CandidateSet chain.
- Environment: darwin, Node 24+, Vite 8, TypeScript 6
- Maturity proposal:
  - shared agent runtime `module_maturity=implemented` for context assembly, 500k/300k compression, output schemas, and provider ports
  - live DeepSeek R1 + Zhihu search + Zhihu direct `integrated` for this isolated runtime, not for the product pipelines
  - path / first-answer / follow-up / ask-author / author-search remain `prototype` on the old chain
  - persistence, cancel/timeout/refresh, and other 4.2 vacancies remain `unresolved`

## Commands

| Command | Exit |
| --- | --- |
| `npm run check` | 0 |
| `npm run check:architecture` | 0 |
| `npm run check:product-invariants` | 0 |
| `npm run test:agent-runtime` | 0 (19 tests) |
| `npm run test:agent-runtime:live` | 0 (6 tests, real Zhihu + DeepSeek) |

## Live gate (real providers, sequential)

- Zhihu search `线性映射 入门` → public hits with stable evidenceId; 刘看山 is not an authorId
- DeepSeek R1 (fast) → 4–5 queries covering `normal_learning` and `pitfall_or_dispute`
- Zhihu direct L0a `concrete_explanation` → non-empty text
- Over-budget attachment is compressed in a copy; original unchanged; compressed R1 still validates
- DeepSeek R1 with thinking enabled still returns parseable JSON after raising max_tokens

## What this slice proves

- All Agent system prompts share the agent-specs 0.7 prefix
- Total budget 500k; attachment branch 300k; no “still too long” error; originals are not overwritten
- R2 exploration objects cannot pass the R4 validator
- A2/N2 reject unknown IDs and 刘看山
- User-triggered runtime calls use real Zhihu and DeepSeek; missing config / non-success HTTP stay explicit

## What this slice does not prove

- Not R1–R4 / R3b product orchestration, publish, or 3D handoff
- Not L0a×3 ∥ L0b first-answer + unique root as one product success state
- Not G1/G2 concurrency, A1–A3, or N0–N2
- Not product HTTP replacement; old `server/live-service.ts` and `server/deepseek.adapter.ts` remain prototype
- Not persistence tables, cancel/timeout/refresh, or attachment lifecycle
