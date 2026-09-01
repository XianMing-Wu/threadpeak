import { z } from 'zod'

export const UuidSchema = z
  .string()
  .uuid()
  .transform((value) => value.toLowerCase())

export const TraceIdSchema = z.string().trim().min(1).max(128)

export const OpenCodeGoProtocolSchema = z.enum([
  'responses',
  'chat_completions',
  'completions',
])

export const EvidenceRecordSchema = z
  .object({
    id: UuidSchema,
    provider: z.literal('zhihu'),
    sourceUrl: z.string().url(),
    title: z.string().max(500),
    excerpt: z.string().max(20_000),
    authorName: z.string().max(200).nullable(),
    publishedAt: z.string().datetime({ offset: true }).nullable(),
    retrievedAt: z.string().datetime({ offset: true }),
    sourceContentSha256: z.string().regex(/^[a-f0-9]{64}$/),
    visibility: z.enum(['public', 'authorized', 'unknown']),
  })
  .strict()

export const sharedEventEnvelopeFields = {
  eventId: UuidSchema,
  occurredAt: z.string().datetime({ offset: true }),
  traceId: TraceIdSchema,
  schemaVersion: z.literal(1),
} as const

export const SharedEventEnvelopeSchema = z
  .object(sharedEventEnvelopeFields)
  .strict()

export type Uuid = z.infer<typeof UuidSchema>
export type TraceId = z.infer<typeof TraceIdSchema>
export type OpenCodeGoProtocol = z.infer<typeof OpenCodeGoProtocolSchema>
export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>
export type SharedEventEnvelope = z.infer<typeof SharedEventEnvelopeSchema>
