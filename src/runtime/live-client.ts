import { createApiClient, type FetchPort, type JsonRequestResult } from '@threadpeak/api-client'

export const LIVE_READY_URL = '/api/ready'
export const LIVE_ANSWER_URL = '/api/answers'
export const LIVE_ANSWER_STREAM_URL = '/api/answers/stream'
export const LIVE_ASK_AUTHOR_URL = '/api/ask-author'
export const LIVE_AUTHOR_SEARCH_URL = '/api/authors/search'
export const LIVE_AUTHOR_NETWORK_URL = '/api/authors/network'
export const LIVE_CANONICAL_ANSWER_URL = '/api/learning/canonical-answer'
export const LIVE_GRAPH_URL = '/api/learning/graph'
export const LIVE_FIRST_ENTRY_URL = '/api/learning/first-entry'
export const LIVE_FOLLOW_UP_URL = '/api/learning/follow-up'

export function createBrowserFetchPort(): FetchPort {
  return async (url, init) => {
    const response = await fetch(url, {
      method: init?.method ?? 'GET',
      headers: init?.headers,
      body: init?.body,
      signal: init?.signal,
    })
    return {
      ok: response.ok,
      status: response.status,
      text: () => response.text(),
      body: response.body,
    }
  }
}

export function createLiveApiClient(fetchPort: FetchPort = createBrowserFetchPort()) {
  return createApiClient({ fetch: fetchPort })
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

export function liveMessageOf(value: unknown, fallback: string): string {
  const message = asRecord(value)?.message
  return typeof message === 'string' && message.trim() ? message.trim() : fallback
}

export async function requestLiveJson(
  url: string,
  body: Record<string, string>,
  traceId: string,
  fetchPort?: FetchPort,
): Promise<JsonRequestResult> {
  const client = createLiveApiClient(fetchPort ?? createBrowserFetchPort())
  return client.requestJson({
    url,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    traceId,
  })
}
