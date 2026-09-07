import type { FetchPort } from '@threadpeak/api-client'
import { createBrowserFetchPort, createLiveApiClient, liveMessageOf, LIVE_FOLLOW_UP_URL, LIVE_READY_URL } from '../runtime/live-client.ts'

export type FollowUpGrow = {
  relation: 'predecessor' | 'successor' | 'parallel'
  title: string
  edgeExplanation: string
}

export type FollowUpResult =
  | { kind: 'completed'; text: string; hostNodeId: string; grow: FollowUpGrow | null }
  | { kind: 'unavailable'; title: string; message: string }

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function asGrow(value: unknown): FollowUpGrow | null {
  const record = asRecord(value)
  if (
    !record
    || (record.relation !== 'predecessor' && record.relation !== 'successor' && record.relation !== 'parallel')
    || typeof record.title !== 'string'
    || !record.title.trim()
    || typeof record.edgeExplanation !== 'string'
    || !record.edgeExplanation.trim()
  ) return null
  return {
    relation: record.relation,
    title: record.title,
    edgeExplanation: record.edgeExplanation,
  }
}

function fallback(): Extract<FollowUpResult, { kind: 'unavailable' }> {
  return {
    kind: 'unavailable',
    title: '无法完成本次追问',
    message: '这次追问没有得到回复。请稍后再试。',
  }
}

async function readNdjson(
  stream: ReadableStream<Uint8Array>,
  hooks?: {
    onDelta?: (text: string) => void
    onTrace?: (steps: unknown) => void
    onReasoning?: (id: string, text: string) => void
  },
): Promise<FollowUpResult> {
  const missing = fallback()
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        let parsed: unknown
        try {
          parsed = JSON.parse(trimmed)
        } catch {
          continue
        }
        const record = asRecord(parsed)
        if (!record) continue
        if (record.kind === 'trace') {
          hooks?.onTrace?.(record.steps)
          continue
        }
        if (record.kind === 'reasoning' && typeof record.id === 'string' && typeof record.text === 'string') {
          hooks?.onReasoning?.(record.id, record.text)
          continue
        }
        if (record.kind === 'delta' && typeof record.text === 'string') {
          text = record.text
          hooks?.onDelta?.(text)
          continue
        }
        if (record.kind === 'completed' && typeof record.text === 'string' && record.text.trim()) {
          hooks?.onDelta?.(record.text)
          return {
            kind: 'completed',
            text: record.text,
            hostNodeId: typeof record.hostNodeId === 'string' ? record.hostNodeId : 'root',
            grow: asGrow(record.grow),
          }
        }
        if (record.kind === 'failed') {
          return { ...missing, message: liveMessageOf(record, missing.message) }
        }
      }
    }
  } catch {
    return missing
  }
  if (text.trim()) return { kind: 'completed', text: text.trim(), hostNodeId: 'root', grow: null }
  return missing
}

export async function requestFollowUp(input: {
  routeId: string
  conceptId: string
  conversationId: string
  question: string
  hostNodeId: string
  quote?: { nodeId: string | null; text: string | null; messageId: string | null }
  neighborhood: unknown
  messages: unknown
  thinkingDepth?: 'fast' | 'deep'
  fetch?: FetchPort
  signal?: AbortSignal
  onDelta?: (text: string) => void
  onTrace?: (steps: unknown) => void
  onReasoning?: (id: string, text: string) => void
}): Promise<FollowUpResult> {
  const missing = fallback()
  const fetchPort = input.fetch ?? createBrowserFetchPort()
  const client = createLiveApiClient(fetchPort)
  const ready = await client.requestJson({
    url: LIVE_READY_URL,
    method: 'GET',
    traceId: 'follow-up-ready',
  })
  const readyBody = asRecord(ready.value)
  if (!ready.ok || readyBody?.ready !== true) return missing
  const response = await fetchPort(LIVE_FOLLOW_UP_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-trace-id': 'follow-up' },
    signal: input.signal,
    body: JSON.stringify({
      routeId: input.routeId,
      conceptId: input.conceptId,
      conversationId: input.conversationId,
      question: input.question,
      hostNodeId: input.hostNodeId,
      quote: input.quote,
      neighborhood: input.neighborhood,
      messages: input.messages,
      thinkingDepth: input.thinkingDepth ?? 'fast',
    }),
  })
  if (!response.body) {
    const raw = await response.text()
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = undefined
    }
    return { ...missing, message: liveMessageOf(parsed, missing.message) }
  }
  return readNdjson(response.body, {
    onDelta: input.onDelta,
    onTrace: input.onTrace,
    onReasoning: input.onReasoning,
  })
}
