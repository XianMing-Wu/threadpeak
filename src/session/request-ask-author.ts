import type { FetchPort } from '@threadpeak/api-client'
import { createLiveApiClient, liveMessageOf, LIVE_ASK_AUTHOR_URL, LIVE_READY_URL } from '../runtime/live-client.ts'
import { resolveAskAuthor, type AskAuthorResolution } from './resolve-ask-author.ts'
import { formatAuthorAnnotation } from './ask-authors.ts'

export type LiveAuthorCard = {
  name: string
  bio: string
  title: string
  url: string
  text: string
  source: 'zhihu-live'
}

export type AskAuthorRequestContext = {
  hostNodeId: string
  hostContent: string
  carrier?: { id?: string; title?: string }
  concept?: { id?: string; title?: string }
  thinkingDepth?: 'fast' | 'deep'
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
  const name = (typeof item.authorName === 'string' ? item.authorName : typeof item.displayName === 'string' ? item.displayName : '').trim()
  const url = (typeof item.evidenceUrl === 'string' ? item.evidenceUrl : typeof item.sourceUrl === 'string' ? item.sourceUrl : '').trim()
  const summary = (typeof item.evidenceSummary === 'string' ? item.evidenceSummary : '').trim()
  const displayText = (typeof item.displayText === 'string' ? item.displayText : typeof item.reason === 'string' ? item.reason : '').trim()
  if (!name || name === '刘看山' || name === '马同学' || name === '李永乐老师') return undefined
  if (!isZhihuUrl(url)) return undefined
  const text = displayText.includes('详细内容可以阅读我的文章')
    ? displayText
    : formatAuthorAnnotation(summary || displayText, url)
  return {
    name,
    bio: '知乎作者',
    title: name,
    url,
    text,
    source: 'zhihu-live',
  }
}

export async function requestAskAuthor(input: {
  question: string
  quote: string
  hostNodeId?: string
  hostContent?: string
  carrier?: { id?: string; title?: string }
  concept?: { id?: string; title?: string }
  thinkingDepth?: 'fast' | 'deep'
  fetch?: FetchPort
}): Promise<AskAuthorLiveResult> {
  const fallback = resolveAskAuthor()
  if (!input.question.trim() || !input.quote.trim()) {
    return {
      ...fallback,
      message: '问博主必须先划选原文，再写下问题。',
    }
  }
  const client = createLiveApiClient(input.fetch)
  const ready = await client.requestJson({ url: LIVE_READY_URL, method: 'GET', traceId: 'ask-author-ready' })
  const readyBody = ready.ok ? asRecord(ready.value) : undefined
  if (!ready.ok || readyBody?.ready !== true) return fallback
  const posted = await client.requestJson({
    url: LIVE_ASK_AUTHOR_URL,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      question: input.question,
      selection: { text: input.quote, anchor: input.hostNodeId ?? '' },
      host: { nodeId: input.hostNodeId ?? '', content: input.hostContent ?? '' },
      carrier: input.carrier ?? {},
      concept: input.concept ?? {},
      thinkingDepth: input.thinkingDepth === 'deep' ? 'deep' : 'fast',
    }),
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
