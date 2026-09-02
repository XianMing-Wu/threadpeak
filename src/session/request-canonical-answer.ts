import type { FetchPort } from '@threadpeak/api-client'
import { createLiveApiClient, liveMessageOf, LIVE_CANONICAL_ANSWER_URL, LIVE_READY_URL } from '../runtime/live-client.ts'


export type CanonicalAnswerResult =
  | { kind: 'completed'; text: string; contentHash: string; evidenceCount: number; reused: boolean }
  | { kind: 'unavailable'; title: string; message: string }

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function fallback(): Extract<CanonicalAnswerResult, { kind: 'unavailable' }> {
  return {
    kind: 'unavailable',
    title: '还没有这次概念的首次回复',
    message: '这条用户路线还没有已 settle 的首次回复。不能用草稿发明一课，也不能在首次回复之前创建知识脉络。',
  }
}

export async function requestCanonicalAnswer(input: {
  routeId: string
  conceptId: string
  title: string
  fetch?: FetchPort
}): Promise<CanonicalAnswerResult> {
  const missing = fallback()
  const client = createLiveApiClient(input.fetch)
  const ready = await client.requestJson({
    url: LIVE_READY_URL,
    method: 'GET',
    traceId: 'canonical-ready',
  })
  const readyBody = asRecord(ready.value)
  if (!ready.ok || readyBody?.ready !== true) return missing
  const posted = await client.requestJson({
    url: LIVE_CANONICAL_ANSWER_URL,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      routeId: input.routeId,
      conceptId: input.conceptId,
      title: input.title,
    }),
    traceId: 'canonical-answer',
  })
  const body = asRecord(posted.value)
  if (
    posted.ok
    && body?.kind === 'completed'
    && typeof body.text === 'string'
    && body.text.trim()
    && typeof body.contentHash === 'string'
  ) {
    return {
      kind: 'completed',
      text: body.text,
      contentHash: body.contentHash,
      evidenceCount: typeof body.evidenceCount === 'number' ? body.evidenceCount : 0,
      reused: body.reused === true,
    }
  }
  return {
    ...missing,
    message: liveMessageOf(posted.value, missing.message),
  }
}

export async function requestCanonicalSnapshot(input: {
  routeId: string
  conceptId: string
  fetch?: FetchPort
}): Promise<CanonicalAnswerResult> {
  const missing = fallback()
  const client = createLiveApiClient(input.fetch)
  const query = new URLSearchParams({
    routeId: input.routeId,
    conceptId: input.conceptId,
  })
  const got = await client.requestJson({
    url: `${LIVE_CANONICAL_ANSWER_URL}?${query.toString()}`,
    method: 'GET',
    traceId: 'canonical-snapshot',
  })
  const body = asRecord(got.value)
  if (
    got.ok
    && body?.kind === 'completed'
    && typeof body.text === 'string'
    && body.text.trim()
    && typeof body.contentHash === 'string'
  ) {
    return {
      kind: 'completed',
      text: body.text,
      contentHash: body.contentHash,
      evidenceCount: typeof body.evidenceCount === 'number' ? body.evidenceCount : 0,
      reused: true,
    }
  }
  return {
    ...missing,
    message: liveMessageOf(got.value, missing.message),
  }
}

export function lessonFromCanonical(title: string, text: string) {
  const paragraphs = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean)
  return {
    heading: title,
    paragraphs: paragraphs.length > 0 ? paragraphs : [text.trim()],
    placeholder: `围绕“${title}”继续提问，或选择上方模式深入理解…`,
  }
}
