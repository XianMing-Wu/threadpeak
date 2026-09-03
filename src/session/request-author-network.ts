import type { FetchPort } from '@threadpeak/api-client'
import { createLiveApiClient, liveMessageOf, LIVE_AUTHOR_NETWORK_URL, LIVE_READY_URL } from '../runtime/live-client.ts'
import { resolveAuthorNetwork, type AuthorNetworkResolution } from './resolve-author-network.ts'

export type AuthorNetworkMember = {
  authorId: string
  name: string
  weight: 'high' | 'low'
  carrierTitle?: string
  conceptTitle?: string
  question: string
}

export type AuthorNetworkLiveResult =
  | { kind: 'list'; authors: readonly AuthorNetworkMember[] }
  | AuthorNetworkResolution

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function asMember(value: unknown): AuthorNetworkMember | undefined {
  const record = asRecord(value)
  if (!record) return undefined
  const name = (typeof record.authorName === 'string' ? record.authorName : typeof record.displayName === 'string' ? record.displayName : '').trim()
  const authorId = (typeof record.authorId === 'string' ? record.authorId : '').trim()
  const weight = record.weight === 'high' || record.weight === 'low' ? record.weight : undefined
  const question = (typeof record.question === 'string' ? record.question : typeof record.normalizedQuestion === 'string' ? record.normalizedQuestion : '').trim()
  if (!name || name === '刘看山' || !weight) return undefined
  return {
    authorId: authorId || name,
    name,
    weight,
    ...(typeof record.carrierTitle === 'string' && record.carrierTitle.trim() ? { carrierTitle: record.carrierTitle.trim() } : {}),
    ...(typeof record.conceptTitle === 'string' && record.conceptTitle.trim() ? { conceptTitle: record.conceptTitle.trim() } : {}),
    question,
  }
}

export async function requestAuthorNetwork(input: { fetch?: FetchPort } = {}): Promise<AuthorNetworkLiveResult> {
  const fallback = resolveAuthorNetwork()
  const client = createLiveApiClient(input.fetch)
  const ready = await client.requestJson({ url: LIVE_READY_URL, method: 'GET', traceId: 'author-network-ready' })
  const readyBody = ready.ok ? asRecord(ready.value) : undefined
  if (!ready.ok || readyBody?.ready !== true) return fallback
  const listed = await client.requestJson({
    url: LIVE_AUTHOR_NETWORK_URL,
    method: 'GET',
    traceId: 'author-network',
  })
  const body = asRecord(listed.value)
  if (listed.ok && body?.kind === 'list' && Array.isArray(body.authors)) {
    const authors = body.authors.map(asMember).filter((item): item is AuthorNetworkMember => Boolean(item))
    return { kind: 'list', authors }
  }
  return {
    ...fallback,
    message: liveMessageOf(listed.value, fallback.message),
  }
}
