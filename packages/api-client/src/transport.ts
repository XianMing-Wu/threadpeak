import { type PublicError } from '@threadpeak/contracts'
import {
  decodePublicError,
  iterateNdjson,
  type DecodeResult,
  type DecodedStreamEvent,
} from './decoder.ts'

export type FetchPort = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>

function transportError(message: string, traceId: string, retryable = true): PublicError {
  return { code: 'TRANSPORT_FAILED', message, traceId, retryable }
}

export function createApiClient(ports: { fetch: FetchPort }) {
  return {
    async readUnknown(url: string, traceId: string): Promise<DecodeResult<unknown>> {
      try {
        const response = await ports.fetch(url, { method: 'GET' })
        const text = await response.text()
        if (!response.ok) {
          const decoded = decodePublicError(safeJson(text), traceId)
          return decoded.ok
            ? { ok: false, error: decoded.value }
            : { ok: false, error: transportError('Request failed with an unsafe error body.', traceId) }
        }
        return { ok: true, value: safeJson(text) }
      } catch {
        return { ok: false, error: transportError('Request failed before a response body was available.', traceId) }
      }
    },

    async *readNdjson(url: string, traceId: string): AsyncGenerator<DecodeResult<DecodedStreamEvent>> {
      let text: string
      try {
        const response = await ports.fetch(url, { method: 'GET' })
        text = await response.text()
        if (!response.ok) {
          const decoded = decodePublicError(safeJson(text), traceId)
          yield {
            ok: false,
            error: decoded.ok
              ? decoded.value
              : transportError('NDJSON request failed with an unsafe error body.', traceId),
          }
          return
        }
      } catch {
        yield { ok: false, error: transportError('NDJSON request failed before a response body was available.', traceId) }
        return
      }
      yield* iterateNdjson(text, traceId)
    },
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}
