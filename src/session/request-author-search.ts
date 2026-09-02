import type { FetchPort } from '@threadpeak/api-client'
import { createLiveApiClient, liveMessageOf, LIVE_AUTHOR_SEARCH_URL, LIVE_READY_URL } from '../runtime/live-client.ts'
import { resolveAuthorSearch, type AuthorSearchResolution } from './resolve-author-search.ts'

export type AuthorSearchLiveResult =
  | { kind: 'results'; origin: 'network' | 'zhihu'; names: readonly string[] }
  | { kind: 'empty' }
  | AuthorSearchResolution

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

export async function requestAuthorSearch(input: {
  query: string
  fetch?: FetchPort
}): Promise<AuthorSearchLiveResult> {
  const fallback = resolveAuthorSearch()
  const client = createLiveApiClient(input.fetch)
  const ready = await client.requestJson({ url: LIVE_READY_URL, method: 'GET', traceId: 'author-search-ready' })
  const readyBody = ready.ok ? asRecord(ready.value) : undefined
  if (!ready.ok || readyBody?.ready !== true) return fallback
  const posted = await client.requestJson({
    url: LIVE_AUTHOR_SEARCH_URL,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: input.query }),
    traceId: 'author-search',
  })
  const body = asRecord(posted.value)
  if (body?.kind === 'empty') return { kind: 'empty' }
  if (body?.kind === 'results' && (body.origin === 'network' || body.origin === 'zhihu') && Array.isArray(body.authors)) {
    const names = body.authors
      .map((item) => {
        const record = asRecord(item)
        const name = typeof record?.displayName === 'string' ? record.displayName.trim() : ''
        return name && name !== '刘看山' ? name : ''
      })
      .filter(Boolean)
      .slice(0, 3)
    if (names.length > 0) return { kind: 'results', origin: body.origin, names }
    return { kind: 'empty' }
  }
  return {
    ...fallback,
    message: liveMessageOf(posted.value, fallback.message),
  }
}
