import type { FetchPort } from '@threadpeak/api-client'
import { createLiveApiClient, liveMessageOf, LIVE_ASK_AUTHOR_URL, LIVE_READY_URL } from '../runtime/live-client.ts'
import { resolveAskAuthor, type AskAuthorResolution } from './resolve-ask-author.ts'

export type LiveAuthorCard = {
  name: string
  bio: string
  title: string
  url: string
  text: string
  source: 'zhihu-live'
}

export type AskAuthorLiveResult =
  | { kind: 'authors'; authors: readonly LiveAuthorCard[] }
  | { kind: 'direct'; text: string }
  | AskAuthorResolution

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function isZhihuUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && (url.hostname === 'zhihu.com' || url.hostname.endsWith('.zhihu.com'))
  } catch {
    return false
  }
}

function asAuthor(value: unknown): LiveAuthorCard | undefined {
  const item = asRecord(value)
  if (!item) return undefined
  const name = typeof item.displayName === 'string' ? item.displayName.trim() : ''
  const url = typeof item.sourceUrl === 'string' ? item.sourceUrl.trim() : ''
  const profile = typeof item.profileUrl === 'string' ? item.profileUrl.trim() : ''
  const bio = typeof item.bio === 'string' ? item.bio.trim() : ''
  const reason = typeof item.reason === 'string' ? item.reason.trim() : ''
  if (!name || name === '刘看山' || name === '马同学' || name === '李永乐老师') return undefined
  if (!isZhihuUrl(url) || (profile && !isZhihuUrl(profile))) return undefined
  return {
    name,
    bio: bio || '知乎作者',
    title: name,
    url,
    text: reason || '来自该作者的公开知乎内容，这是摘要而不是作者新写的回复。',
    source: 'zhihu-live',
  }
}

export async function requestAskAuthor(input: {
  question: string
  quote: string
  fetch?: FetchPort
}): Promise<AskAuthorLiveResult> {
  const fallback = resolveAskAuthor()
  const client = createLiveApiClient(input.fetch)
  const ready = await client.requestJson({ url: LIVE_READY_URL, method: 'GET', traceId: 'ask-author-ready' })
  const readyBody = ready.ok ? asRecord(ready.value) : undefined
  if (!ready.ok || readyBody?.ready !== true) return fallback
  const posted = await client.requestJson({
    url: LIVE_ASK_AUTHOR_URL,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question: input.question, quote: input.quote }),
    traceId: 'ask-author',
  })
  const body = asRecord(posted.value)
  if (body?.kind === 'direct' && typeof body.text === 'string' && body.text.trim()) {
    return { kind: 'direct', text: body.text }
  }
  if (body?.kind === 'authors' && Array.isArray(body.authors)) {
    const authors = body.authors.map(asAuthor).filter((item): item is LiveAuthorCard => Boolean(item)).slice(0, 2)
    if (authors.length > 0) return { kind: 'authors', authors }
  }
  return {
    ...fallback,
    message: liveMessageOf(posted.value, fallback.message),
  }
}
