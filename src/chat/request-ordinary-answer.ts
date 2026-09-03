import { createBrowserFetchPort, createLiveApiClient, liveMessageOf, LIVE_ANSWER_STREAM_URL, LIVE_ANSWER_URL, LIVE_READY_URL } from '../runtime/live-client.ts'
import type { FetchPort } from '@threadpeak/api-client'
import { resolveOrdinaryAnswer, type OrdinaryAnswerResolution } from './resolve-ordinary-answer.ts'
import type { OrdinaryChatAttachmentInput, OrdinaryChatContext } from './build-ordinary-chat-context.ts'

export type OrdinaryAnswerResult =
  | { kind: 'completed'; text: string }
  | OrdinaryAnswerResolution

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function bodyOf(input: {
  currentMessage: string
  conversation?: OrdinaryChatContext['conversation']
  attachments?: readonly OrdinaryChatAttachmentInput[]
  thinkingDepth?: 'fast' | 'deep'
}) {
  return JSON.stringify({
    currentMessage: input.currentMessage,
    conversation: input.conversation ?? [],
    attachments: input.attachments ?? [],
    thinkingDepth: input.thinkingDepth === 'deep' ? 'deep' : 'fast',
  })
}

export async function requestOrdinaryAnswer(input: {
  currentMessage: string
  conversation?: OrdinaryChatContext['conversation']
  attachments?: readonly OrdinaryChatAttachmentInput[]
  thinkingDepth?: 'fast' | 'deep'
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
    body: bodyOf(input),
    traceId: 'ordinary-answer',
  })
  const body = asRecord(posted.value)
  if (posted.ok && body?.kind === 'completed' && typeof body.text === 'string' && body.text.trim()) {
    return { kind: 'completed', text: body.text }
  }
  return {
    ...fallback,
    message: liveMessageOf(posted.value, fallback.message),
  }
}

async function readNdjson(
  stream: ReadableStream<Uint8Array>,
  hooks?: { onDelta?: (text: string) => void },
): Promise<OrdinaryAnswerResult> {
  const fallback = resolveOrdinaryAnswer()
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''
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
        if (record.kind === 'delta' && typeof record.text === 'string') {
          full += record.text
          hooks?.onDelta?.(full)
          continue
        }
        if (record.kind === 'completed' && typeof record.text === 'string' && record.text.trim()) {
          hooks?.onDelta?.(record.text)
          return { kind: 'completed', text: record.text }
        }
        if (record.kind === 'failed') {
          return { ...fallback, message: liveMessageOf(record, fallback.message) }
        }
      }
    }
  } catch {
    return fallback
  }
  if (full.trim()) return { kind: 'completed', text: full.trim() }
  return fallback
}

export async function requestOrdinaryAnswerStream(input: {
  currentMessage: string
  conversation?: OrdinaryChatContext['conversation']
  attachments?: readonly OrdinaryChatAttachmentInput[]
  thinkingDepth?: 'fast' | 'deep'
  fetch?: FetchPort
  onDelta?: (text: string) => void
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
    body: bodyOf(input),
  })
  if (response.body) {
    return readNdjson(response.body, { onDelta: input.onDelta })
  }
  return requestOrdinaryAnswer(input)
}
