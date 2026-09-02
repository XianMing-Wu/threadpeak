import { createLiveApiClient, liveMessageOf, LIVE_ANSWER_URL, LIVE_READY_URL } from '../runtime/live-client.ts'
import type { FetchPort } from '@threadpeak/api-client'
import { resolveOrdinaryAnswer, type OrdinaryAnswerResolution } from './resolve-ordinary-answer.ts'

export type OrdinaryAnswerResult =
  | { kind: 'completed'; text: string; evidenceCount: number }
  | OrdinaryAnswerResolution

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

export async function requestOrdinaryAnswer(input: {
  question: string
  topic?: string
  quote?: string
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
