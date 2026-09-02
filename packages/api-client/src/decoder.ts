import {
  PublicErrorSchema,
  STREAM_RESOURCE_KEYS,
  SharedEventEnvelopeSchema,
  StreamEventMetaSchema,
  type PublicError,
  type SharedEventEnvelope,
} from '@threadpeak/contracts'

export type DecodeSuccess<T> = {
  ok: true
  value: T
}

export type DecodeFailure = {
  ok: false
  error: PublicError
}

export type DecodeResult<T> = DecodeSuccess<T> | DecodeFailure

export type DecodedStreamEvent = {
  envelope: SharedEventEnvelope
  resourceId: string
  sequence: number
  raw: Readonly<Record<string, unknown>>
}

const DECODE_TRACE = 'client-decode'

function publicError(code: PublicError['code'], message: string, traceId: string, retryable?: boolean): PublicError {
  return retryable === undefined
    ? { code, message, traceId }
    : { code, message, traceId, retryable }
}

function asRecord(input: unknown): Record<string, unknown> | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined
  return Object.fromEntries(Object.entries(input))
}

function traceOf(input: unknown, fallbackTraceId: string): string {
  const record = asRecord(input)
  return typeof record?.traceId === 'string' && record.traceId.trim() ? record.traceId.trim() : fallbackTraceId
}

export function decodePublicError(input: unknown, fallbackTraceId = DECODE_TRACE): DecodeResult<PublicError> {
  const parsed = PublicErrorSchema.safeParse(input)
  if (parsed.success) return { ok: true, value: parsed.data }
  return {
    ok: false,
    error: publicError('SCHEMA_INVALID', 'Error payload failed schema validation.', fallbackTraceId),
  }
}

export function decodeSharedEnvelope(input: unknown, fallbackTraceId = DECODE_TRACE): DecodeResult<SharedEventEnvelope> {
  const record = asRecord(input)
  if (!record) {
    return {
      ok: false,
      error: publicError('SCHEMA_INVALID', 'Event payload must be an object.', fallbackTraceId),
    }
  }
  if (typeof record.schemaVersion === 'number' && record.schemaVersion !== 1) {
    return {
      ok: false,
      error: publicError('SCHEMA_INCOMPATIBLE', 'Unsupported event schema version.', traceOf(record, fallbackTraceId)),
    }
  }
  const parsed = SharedEventEnvelopeSchema.safeParse({
    eventId: record.eventId,
    occurredAt: record.occurredAt,
    traceId: record.traceId,
    schemaVersion: record.schemaVersion,
  })
  if (!parsed.success) {
    return {
      ok: false,
      error: publicError('SCHEMA_INVALID', 'Event envelope failed schema validation.', traceOf(record, fallbackTraceId)),
    }
  }
  return { ok: true, value: parsed.data }
}

export function decodeStreamPayload(input: unknown, fallbackTraceId = DECODE_TRACE): DecodeResult<DecodedStreamEvent> {
  const record = asRecord(input)
  if (!record) {
    return {
      ok: false,
      error: publicError('SCHEMA_INVALID', 'Stream event must be an object.', fallbackTraceId),
    }
  }
  const envelope = decodeSharedEnvelope(record, fallbackTraceId)
  if (!envelope.ok) return envelope
  const resourceId = STREAM_RESOURCE_KEYS
    .map((key) => record[key])
    .find((value): value is string => typeof value === 'string' && value.trim().length > 0)
    ?.trim()
  const meta = StreamEventMetaSchema.safeParse({
    resourceId,
    sequence: record.sequence,
  })
  if (!meta.success) {
    return {
      ok: false,
      error: publicError('SCHEMA_INVALID', 'Stream event is missing a resource cursor.', envelope.value.traceId),
    }
  }
  return {
    ok: true,
    value: {
      envelope: envelope.value,
      resourceId: meta.data.resourceId,
      sequence: meta.data.sequence,
      raw: Object.freeze({ ...record }),
    },
  }
}

function parseJsonText(text: string, fallbackTraceId: string): DecodeResult<unknown> {
  try {
    return { ok: true, value: JSON.parse(text) as unknown }
  } catch {
    return {
      ok: false,
      error: publicError('SCHEMA_INVALID', 'Payload is not valid JSON.', fallbackTraceId),
    }
  }
}

export function decodeNdjsonLine(line: string, fallbackTraceId = DECODE_TRACE): DecodeResult<DecodedStreamEvent> | { ok: true; skipped: true } {
  const trimmed = line.trim()
  if (!trimmed) return { ok: true, skipped: true }
  const json = parseJsonText(trimmed, fallbackTraceId)
  if (!json.ok) return json
  return decodeStreamPayload(json.value, fallbackTraceId)
}

export function decodeSseBlock(block: string, fallbackTraceId = DECODE_TRACE): DecodeResult<DecodedStreamEvent> {
  const dataLines: string[] = []
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
  }
  if (dataLines.length === 0) {
    return {
      ok: false,
      error: publicError('SCHEMA_INVALID', 'SSE block has no data field.', fallbackTraceId),
    }
  }
  const json = parseJsonText(dataLines.join('\n'), fallbackTraceId)
  if (!json.ok) return json
  return decodeStreamPayload(json.value, fallbackTraceId)
}

export async function* iterateNdjson(
  body: string,
  fallbackTraceId = DECODE_TRACE,
): AsyncGenerator<DecodeResult<DecodedStreamEvent>> {
  for (const line of body.split(/\r?\n/)) {
    const decoded = decodeNdjsonLine(line, fallbackTraceId)
    if ('skipped' in decoded) continue
    yield decoded
  }
}

export async function* iterateNdjsonStream(
  body: ReadableStream<Uint8Array>,
  fallbackTraceId = DECODE_TRACE,
): AsyncGenerator<DecodeResult<DecodedStreamEvent>> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done })
      const lines = buffer.split(/\r?\n/)
      buffer = done ? '' : lines.pop() ?? ''
      for (const line of lines) {
        const decoded = decodeNdjsonLine(line, fallbackTraceId)
        if ('skipped' in decoded) continue
        yield decoded
      }
      if (done) return
    }
  } finally {
    reader.releaseLock()
  }
}
