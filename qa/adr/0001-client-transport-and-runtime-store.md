# ADR 0001 — Client transport and RuntimeStore

## Status

Accepted for the transport/store strangler slice.

## Decision

Cross-process transport primitives live in `@threadpeak/contracts`:
`PublicError`, `StreamCursor`, and shared stream meta (`resourceId` + `sequence`) on top of `SharedEventEnvelope`.

`@threadpeak/api-client` owns decode and injected-fetch transport. It parses envelope and cursor fields and leaves remaining keys as raw input for a later context projector. Path NDJSON and knowledge SSE use separate decode functions and must not share one mixed stream.

`@threadpeak/runtime-store` owns the headless committed snapshot, `eventId`/sequence apply rules, inflight UI, and teardown. Pages read through selectors. React bindings live in `src/runtime/`, not in the store package.

This slice does not copy path or knowledge domain event payloads, and it does not add a product write chain.

## Deletion / next move

Replace `src/runtime/projectLibraryReadModel` with owner-scoped GET projections when path and knowledge list resources exist. Delete that compatibility projector when Home/Collections no longer import `workspace/store` as a read model.
