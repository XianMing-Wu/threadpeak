import { type PublicError } from '@threadpeak/contracts'
import {
  decodePublicError,
  iterateNdjson,
  iterateNdjsonStream,
  type DecodeResult,
  type DecodedStreamEvent,
} from './decoder.ts'

export type FetchInit = {
  method?: string
  headers?: Record<string, string>
  body?: string
  signal?: AbortSignal
}

export type FetchResponse = {
  ok: boolean
  status: number
  text: () => Promise<string>
  body?: ReadableStream<Uint8Array> | null
}

export type FetchPort = (
  input: string,
  init?: FetchInit,
) => Promise<FetchResponse>

export type JsonRequestResult =
  | { ok: true; status: number; value: unknown }
  | { ok: false; status?: number; value?: unknown; aborted?: boolean; error: PublicError }

function transportError(message: string, traceId: string, retryable = true): PublicError {
  return { code: 'TRANSPORT_FAILED', message, traceId, retryable }
}

function isAbort(cause: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true
  return cause instanceof Error && cause.name === 'AbortError'
}

export function createApiClient(ports: { fetch: FetchPort }) {
  return {
    async requestJson(spec: {
      url: string
      method: 'GET' | 'POST'
      headers?: Record<string, string>
      body?: string
      signal?: AbortSignal
      traceId: string
    }): Promise<JsonRequestResult> {
      try {
        const response = await ports.fetch(spec.url, {
          method: spec.method,
          headers: spec.headers,
          body: spec.body,
          signal: spec.signal,
        })
        const text = await response.text()
        const value = safeJson(text)
        if (!response.ok) {
          const decoded = decodePublicError(value, spec.traceId)
          return {
            ok: false,
            status: response.status,
            value,
            error: decoded.ok
              ? decoded.value
              : transportError('Request failed with a non-success status.', spec.traceId),
          }
        }
        return { ok: true, status: response.status, value }
      } catch (cause) {
        if (isAbort(cause, spec.signal)) {
          return {
            ok: false,
            aborted: true,
            error: transportError('Request was aborted.', spec.traceId, false),
          }
        }
        return {
          ok: false,
          error: transportError('Request failed before a response body was available.', spec.traceId),
        }
      }
    },

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
      try {
        const response = await ports.fetch(url, { method: 'GET' })
        if (!response.ok) {
          const text = await response.text()
          const decoded = decodePublicError(safeJson(text), traceId)
          yield {
            ok: false,
            error: decoded.ok
              ? decoded.value
              : transportError('NDJSON request failed with an unsafe error body.', traceId),
          }
          return
        }
        if (response.body && typeof response.body.getReader === 'function') {
          yield* iterateNdjsonStream(response.body, traceId)
          return
        }
        yield* iterateNdjson(await response.text(), traceId)
      } catch {
        yield { ok: false, error: transportError('NDJSON request failed before a response body was available.', traceId) }
      }
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
