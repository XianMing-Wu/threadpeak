import type { FetchPort } from '@threadpeak/api-client'
import { createLiveApiClient, liveMessageOf, LIVE_FIRST_ENTRY_URL, LIVE_READY_URL } from '../runtime/live-client.ts'
import type { GraphSnapshot } from './request-graph-bootstrap.ts'
import { lessonFromCanonical } from './request-canonical-answer.ts'

export type FirstEntryResult =
  | {
    kind: 'completed'
    text: string
    contentHash: string
    title: string
    reused: boolean
    graph: GraphSnapshot
  }
  | { kind: 'unavailable'; title: string; message: string }

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function fallback(): Extract<FirstEntryResult, { kind: 'unavailable' }> {
  return {
    kind: 'unavailable',
    title: '还没有这次概念的首次回复',
    message: '这条用户路线还没有已 settle 的首次回复。不能用草稿发明一课，也不能在首次回复之前创建知识脉络。',
  }
}

function asGraph(body: Record<string, unknown>, reused: boolean): GraphSnapshot | undefined {
  const graph = asRecord(body.graph) ?? body
  const root = asRecord(graph.root)
  if (
    !root
    || typeof graph.graphId !== 'string'
    || typeof graph.routeId !== 'string'
    || typeof graph.conceptId !== 'string'
    || typeof graph.canonicalContentHash !== 'string'
    || typeof graph.revision !== 'number'
    || root.role !== 'root'
    || typeof root.nodeId !== 'string'
    || typeof root.title !== 'string'
    || typeof root.canonicalContentHash !== 'string'
    || root.canonicalContentHash !== graph.canonicalContentHash
  ) return undefined
  return {
    graphId: graph.graphId,
    routeId: graph.routeId,
    conceptId: graph.conceptId,
    canonicalContentHash: graph.canonicalContentHash,
    revision: graph.revision,
    root: {
      nodeId: root.nodeId,
      title: root.title,
      role: 'root',
      canonicalContentHash: root.canonicalContentHash,
    },
    draftCount: 0,
    reused,
  }
}

function completedOf(body: Record<string, unknown>): FirstEntryResult | undefined {
  const graph = asGraph(body, body.reused === true)
  if (
    body.kind !== 'completed'
    || typeof body.text !== 'string'
    || !body.text.trim()
    || typeof body.contentHash !== 'string'
    || !graph
    || graph.canonicalContentHash !== body.contentHash
  ) return undefined
  return {
    kind: 'completed',
    text: body.text,
    contentHash: body.contentHash,
    title: graph.root.title,
    reused: body.reused === true,
    graph,
  }
}

export async function requestFirstEntrySnapshot(input: {
  routeId: string
  conceptId: string
  fetch?: FetchPort
}): Promise<FirstEntryResult> {
  const missing = fallback()
  const client = createLiveApiClient(input.fetch)
  const query = new URLSearchParams({ routeId: input.routeId, conceptId: input.conceptId })
  const got = await client.requestJson({
    url: `${LIVE_FIRST_ENTRY_URL}?${query.toString()}`,
    method: 'GET',
    traceId: 'first-entry-snapshot',
  })
  const body = asRecord(got.value)
  if (got.ok && body) {
    const completed = completedOf(body)
    if (completed) return completed
  }
  if (got.status === 404 || body?.kind === 'missing') return missing
  return { ...missing, message: liveMessageOf(got.value, missing.message) }
}

export async function requestFirstEntry(input: {
  routeId: string
  conceptId: string
  title: string
  hasDispute?: boolean
  detailedDescription?: string
  attachmentSourceIds?: readonly string[]
  thinkingDepth?: 'fast' | 'deep'
  fetch?: FetchPort
}): Promise<FirstEntryResult> {
  const missing = fallback()
  const client = createLiveApiClient(input.fetch)
  const ready = await client.requestJson({
    url: LIVE_READY_URL,
    method: 'GET',
    traceId: 'first-entry-ready',
  })
  const readyBody = asRecord(ready.value)
  if (!ready.ok || readyBody?.ready !== true) return missing
  const posted = await client.requestJson({
    url: LIVE_FIRST_ENTRY_URL,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      routeId: input.routeId,
      conceptId: input.conceptId,
      title: input.title,
      hasDispute: input.hasDispute === true,
      detailedDescription: input.detailedDescription ?? '',
      attachmentSourceIds: input.attachmentSourceIds ?? [],
      thinkingDepth: input.thinkingDepth ?? 'fast',
    }),
    traceId: 'first-entry',
  })
  const body = asRecord(posted.value)
  if (posted.ok && body) {
    const completed = completedOf(body)
    if (completed) return completed
  }
  return { ...missing, message: liveMessageOf(posted.value, missing.message) }
}

export { lessonFromCanonical }
