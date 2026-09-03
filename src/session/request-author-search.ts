import type { FetchPort } from '@threadpeak/api-client'
import { createLiveApiClient, liveMessageOf, LIVE_AUTHOR_SEARCH_URL, LIVE_READY_URL } from '../runtime/live-client.ts'
import { resolveAuthorSearch, type AuthorSearchResolution } from './resolve-author-search.ts'

export type AuthorSearchOrigin = 'high-weight' | 'low-weight' | 'zhihu'

export type AuthorSearchPerson = {
  authorId: string
  name: string
  origin: AuthorSearchOrigin
}

export type AuthorSearchLiveResult =
  | { kind: 'results'; authors: readonly AuthorSearchPerson[] }
  | { kind: 'empty' }
  | AuthorSearchResolution

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function asOrigin(value: unknown): AuthorSearchOrigin | undefined {
  if (value === 'high-weight' || value === 'low-weight' || value === 'zhihu') return value
  if (value === 'network') return 'high-weight'
  return undefined
}

function asPerson(value: unknown): AuthorSearchPerson | undefined {
  const record = asRecord(value)
  if (!record) return undefined
  const name = (typeof record.authorName === 'string' ? record.authorName : typeof record.displayName === 'string' ? record.displayName : '').trim()
  const authorId = (typeof record.authorId === 'string' ? record.authorId : '').trim()
  const origin = asOrigin(record.origin)
  if (!name || name === '刘看山' || !origin) return undefined
  return { authorId: authorId || name, name, origin }
}

export async function requestAuthorSearch(input: {
  query: string
  thinkingDepth?: 'fast' | 'deep'
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
    body: JSON.stringify({
      query: input.query,
      thinkingDepth: input.thinkingDepth === 'deep' ? 'deep' : 'fast',
    }),
    traceId: 'author-search',
  })
  const body = asRecord(posted.value)
  if (body?.kind === 'empty') return { kind: 'empty' }
  if (body?.kind === 'results' && Array.isArray(body.authors)) {
    const authors = body.authors.map(asPerson).filter((item): item is AuthorSearchPerson => Boolean(item)).slice(0, 3)
    if (authors.length > 0) return { kind: 'results', authors }
    return { kind: 'empty' }
  }
  return {
    ...fallback,
    message: liveMessageOf(posted.value, fallback.message),
  }
}
