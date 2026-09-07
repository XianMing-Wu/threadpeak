import type { FetchPort } from '@threadpeak/api-client'
import { createLiveApiClient, liveMessageOf, LIVE_FIRST_ENTRY_URL, LIVE_READY_URL } from '../runtime/live-client.ts'
import { asProcessSteps, settleTrace, type ProcessStep } from '../process-trace.ts'
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
    trace: ProcessStep[]
  }
  | { kind: 'running'; trace: ProcessStep[]; draftText?: string }
  | { kind: 'unavailable'; title: string; message: string; trace: ProcessStep[] }

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function fallback(trace: ProcessStep[] = []): Extract<FirstEntryResult, { kind: 'unavailable' }> {
  return {
    kind: 'unavailable',
    title: '还没有第一段讲解',
    message: '这次学习还没准备好第一段讲解。请先从路线进入学习。',
    trace,
  }
}

function traceOf(body: Record<string, unknown> | undefined): ProcessStep[] {
  return asProcessSteps(body?.trace) ?? []
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
    trace: traceOf(body),
  }
}

async function readSnapshot(input: {
  routeId: string
  conceptId: string
  fetch?: FetchPort
  signal?: AbortSignal
}): Promise<FirstEntryResult> {
  const missing = fallback()
  const client = createLiveApiClient(input.fetch)
  const query = new URLSearchParams({ routeId: input.routeId, conceptId: input.conceptId })
  const got = await client.requestJson({
    url: `${LIVE_FIRST_ENTRY_URL}?${query.toString()}`,
    method: 'GET',
    traceId: 'first-entry-snapshot',
    signal: input.signal,
  })
  const body = asRecord(got.value)
  if (body?.kind === 'running') {
    return {
      kind: 'running',
      trace: traceOf(body),
      ...(typeof body.draftText === 'string' && body.draftText ? { draftText: body.draftText } : {}),
    }
  }
  if (got.ok && body) {
    const completed = completedOf(body)
    if (completed) return completed
  }
  if (body?.kind === 'failed') {
    return {
      ...missing,
      message: liveMessageOf(body, missing.message),
      trace: traceOf(body),
    }
  }
  if (got.status === 404 || body?.kind === 'missing') return missing
  return { ...missing, message: liveMessageOf(got.value, missing.message), trace: traceOf(body) }
}

async function watchFirstEntry(
  input: {
    routeId: string
    conceptId: string
    fetch?: FetchPort
    onTrace?: (steps: ProcessStep[]) => void
    onDraft?: (text: string) => void
    signal?: AbortSignal
  },
  initial: FirstEntryResult,
): Promise<FirstEntryResult> {
  let current = initial
  while (current.kind === 'running') {
    if (input.signal?.aborted) {
      return { kind: 'unavailable', title: '生成已停止', message: '生成已停止。', trace: settleTrace(current.trace, 'stopped') }
    }
    input.onTrace?.(current.trace)
    input.onDraft?.(current.draftText ?? '')
    await new Promise((resolve) => setTimeout(resolve, 160))
    current = await readSnapshot(input)
  }
  if (current.kind === 'completed' || current.kind === 'unavailable') input.onTrace?.(current.trace)
  return current
}

export async function requestFirstEntrySnapshot(input: {
  routeId: string
  conceptId: string
  fetch?: FetchPort
  onTrace?: (steps: ProcessStep[]) => void
  onDraft?: (text: string) => void
  signal?: AbortSignal
}): Promise<FirstEntryResult> {
  return watchFirstEntry(input, await readSnapshot(input))
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
  onTrace?: (steps: ProcessStep[]) => void
  onDraft?: (text: string) => void
  signal?: AbortSignal
}): Promise<FirstEntryResult> {
  const missing = fallback()
  const client = createLiveApiClient(input.fetch)
  const ready = await client.requestJson({
    url: LIVE_READY_URL,
    method: 'GET',
    traceId: 'first-entry-ready',
    signal: input.signal,
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
    signal: input.signal,
  })
  const body = asRecord(posted.value)
  if (posted.ok && body) {
    const completed = completedOf(body)
    if (completed) {
      input.onTrace?.(completed.trace)
      return completed
    }
    if (body.kind === 'running') {
      const running = {
        kind: 'running' as const,
        trace: traceOf(body),
        ...(typeof body.draftText === 'string' && body.draftText ? { draftText: body.draftText } : {}),
      }
      input.onTrace?.(running.trace)
      input.onDraft?.(running.draftText ?? '')
      return watchFirstEntry(input, running)
    }
  }
  return { ...missing, message: liveMessageOf(posted.value, missing.message), trace: traceOf(body) }
}

export { lessonFromCanonical }
