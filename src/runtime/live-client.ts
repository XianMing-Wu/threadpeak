import { createApiClient, type FetchPort, type JsonRequestResult } from '@threadpeak/api-client'

export const LIVE_READY_URL = '/api/ready'

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
