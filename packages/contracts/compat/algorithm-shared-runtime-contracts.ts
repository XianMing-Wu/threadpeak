/**
 * In-repo stand-in for ../算法/shared/runtime-contracts.ts.
 * Owner: packages/contracts
 * 删除条件: 与 ../算法/shared/runtime-contracts.ts 同时删除。
 * Transport schemas stay on @threadpeak/contracts and must not leak through this entry.
 */
export {
  EvidenceRecordSchema,
  SharedEventEnvelopeSchema,
  TraceIdSchema,
  UuidSchema,
  sharedEventEnvelopeFields,
  type EvidenceRecord,
  type SharedEventEnvelope,
  type TraceId,
  type Uuid,
} from '../src/runtime-contracts.ts'
