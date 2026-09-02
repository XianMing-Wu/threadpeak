import { createBrowserFetchPort, createLiveApiClient, liveMessageOf, LIVE_ANSWER_STREAM_URL, LIVE_ANSWER_URL, LIVE_READY_URL } from '../runtime/live-client.ts'
import type { FetchPort } from '@threadpeak/api-client'
import type { GrowCandidate, GrowDecision } from '../knowledge-canvas/grow-decision'
import type { GrowKind } from '../knowledge-canvas/generate'
import { resolveOrdinaryAnswer, type OrdinaryAnswerResolution } from './resolve-ordinary-answer.ts'

export type AnswerStatusStage = 'search' | 'classify' | 'compose'

export type OrdinaryAnswerResult =
  | { kind: 'completed'; text: string; evidenceCount: number; grow?: GrowDecision }
  | OrdinaryAnswerResolution

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

export async function requestOrdinaryAnswer(input: {
  question: string
  topic?: string
  quote?: string
  graphContext?: string
  hostTitle?: string
  fetch?: FetchPort
}): Promise<OrdinaryAnswerResult> {
  const fallback = resolveOrdinaryAnswer()
  const client = createLiveApiClient(input.fetch)
  const ready = await client.requestJson({
    url: LIVE_READY_URL,
    method: 'GET',
    traceId: 'ordinary-answer-ready',
  })
  const readyBody = ready.ok ? asRecord(ready.value) : undefined
  if (!ready.ok || readyBody?.ready !== true) return fallback
  const posted = await client.requestJson({
    url: LIVE_ANSWER_URL,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      question: input.question,
      ...(input.topic ? { topic: input.topic } : {}),
      ...(input.quote ? { quote: input.quote } : {}),
      ...(input.graphContext ? { graphContext: input.graphContext } : {}),
      ...(input.hostTitle ? { hostTitle: input.hostTitle } : {}),
    }),
    traceId: 'ordinary-answer',
  })
  const body = asRecord(posted.value)
  if (posted.ok && body?.kind === 'completed' && typeof body.text === 'string' && body.text.trim()) {
    return {
      kind: 'completed',
      text: body.text,
      evidenceCount: typeof body.evidenceCount === 'number' ? body.evidenceCount : 0,
    }
  }
  return {
    ...fallback,
    message: liveMessageOf(posted.value, fallback.message),
  }
}

async function readNdjson(
  stream: ReadableStream<Uint8Array>,
  hooks?: {
    onDelta?: (text: string) => void
    onStatus?: (stage: AnswerStatusStage) => void
    onGrow?: (grow: GrowDecision) => void
  },
): Promise<OrdinaryAnswerResult> {
  const fallback = resolveOrdinaryAnswer()
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''
  let grow: GrowDecision | undefined
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split(/\n/)
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        let parsed: unknown
        try {
          parsed = JSON.parse(trimmed) as unknown
        } catch {
          continue
        }
        const record = asRecord(parsed)
        if (!record) continue
        if (record.kind === 'status' && (record.stage === 'search' || record.stage === 'classify' || record.stage === 'compose')) {
          hooks?.onStatus?.(record.stage)
          continue
        }
        if (record.kind === 'grow') {
          const payload = asRecord(record.grow) ?? record
          const kind: GrowKind | undefined = payload.kind === 'pred' || payload.kind === 'succ' || payload.kind === 'par' ? payload.kind : undefined
          if (!kind) continue
          const next: GrowDecision = {
            kind,
            title: typeof payload.title === 'string' ? payload.title : '',
            reason: typeof payload.reason === 'string' ? payload.reason : '',
            mergeNodeId: typeof payload.mergeNodeId === 'string' ? payload.mergeNodeId : null,
            source: 'model',
          }
          grow = next
          hooks?.onGrow?.(next)
          continue
        }
        if (record.kind === 'delta' && typeof record.text === 'string') {
          full += record.text
          hooks?.onDelta?.(full)
          continue
        }
        if (record.kind === 'completed' && typeof record.text === 'string' && record.text.trim()) {
          hooks?.onDelta?.(record.text)
          return {
            kind: 'completed',
            text: record.text,
            evidenceCount: typeof record.evidenceCount === 'number' ? record.evidenceCount : 0,
            ...(grow ? { grow } : {}),
          }
        }
        if (record.kind === 'failed') {
          return { ...fallback, message: liveMessageOf(record, fallback.message) }
        }
      }
    }
  } catch {
    return fallback
  }
  if (full.trim()) return { kind: 'completed', text: full.trim(), evidenceCount: 0, ...(grow ? { grow } : {}) }
  return fallback
}

export async function requestOrdinaryAnswerStream(input: {
  question: string
  topic?: string
  quote?: string
  graphContext?: string
  hostTitle?: string
  candidates?: readonly GrowCandidate[]
  fetch?: FetchPort
  onDelta?: (text: string) => void
  onStatus?: (stage: AnswerStatusStage) => void
  onGrow?: (grow: GrowDecision) => void
}): Promise<OrdinaryAnswerResult> {
  const fallback = resolveOrdinaryAnswer()
  const fetchPort = input.fetch ?? createBrowserFetchPort()
  const client = createLiveApiClient(fetchPort)
  const ready = await client.requestJson({
    url: LIVE_READY_URL,
    method: 'GET',
    traceId: 'ordinary-answer-ready',
  })
  const readyBody = ready.ok ? asRecord(ready.value) : undefined
  if (!ready.ok || readyBody?.ready !== true) return fallback
  const response = await fetchPort(LIVE_ANSWER_STREAM_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      question: input.question,
      ...(input.topic ? { topic: input.topic } : {}),
      ...(input.quote ? { quote: input.quote } : {}),
      ...(input.graphContext ? { graphContext: input.graphContext } : {}),
      ...(input.hostTitle ? { hostTitle: input.hostTitle } : {}),
      ...(input.candidates ? { candidates: input.candidates } : {}),
    }),
  })
  if (response.body) {
    return readNdjson(response.body, {
      onDelta: input.onDelta,
      onStatus: input.onStatus,
      onGrow: input.onGrow,
    })
  }
  return requestOrdinaryAnswer(input)
}
