import { z } from 'zod'
import { sharedEventEnvelopeFields, TraceIdSchema, UuidSchema } from './runtime-contracts.ts'

export const PublicErrorCodeSchema = z.enum([
  'SCHEMA_INVALID',
  'SCHEMA_INCOMPATIBLE',
  'STREAM_GAP',
  'TRANSPORT_FAILED',
])

export const PublicErrorSchema = z
  .object({
    code: PublicErrorCodeSchema,
    message: z.string().trim().min(1).max(500),
    traceId: TraceIdSchema,
    retryable: z.boolean().optional(),
  })
  .strict()

export const StreamCursorSchema = z
  .object({
    resourceId: z.string().trim().min(1).max(200),
    lastEventId: UuidSchema,
    sequence: z.number().int().nonnegative(),
  })
  .strict()

export const STREAM_RESOURCE_KEYS = [
  'resourceId',
  'aggregateId',
  'pathSessionId',
  'sessionId',
  'requestId',
  'conversationId',
  'knowledgeId',
  'knowledgeGraphId',
] as const

export const sharedStreamEventFields = {
  ...sharedEventEnvelopeFields,
  resourceId: z.string().trim().min(1).max(200),
  sequence: z.number().int().positive(),
} as const

export const StreamEventMetaSchema = z
  .object({
    resourceId: sharedStreamEventFields.resourceId,
    sequence: sharedStreamEventFields.sequence,
  })
  .strict()

export type PublicErrorCode = z.infer<typeof PublicErrorCodeSchema>
export type PublicError = z.infer<typeof PublicErrorSchema>
export type StreamCursor = z.infer<typeof StreamCursorSchema>
export type StreamEventMeta = z.infer<typeof StreamEventMetaSchema>
