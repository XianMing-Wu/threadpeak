/** In-process canonical first-answer store used by first-learning L0a/L0b. */
import { createHash } from 'node:crypto'

export type CanonicalAnswer = {
  routeId: string
  conceptId: string
  text: string
  contentHash: string
  evidenceCount: number
}

export type CanonicalEnsureResult =
  | { kind: 'completed'; answer: CanonicalAnswer; reused: boolean }
  | { kind: 'failed'; code: 'PROVIDER_UNAVAILABLE' | 'PROVIDER_INVALID'; message: string }

export type CanonicalGenerate = (input: {
  question: string
  topic: string
}) => Promise<{ kind: 'completed'; text: string; evidenceCount: number } | { kind: 'failed'; message: string }>

function scopeKey(routeId: string, conceptId: string): string {
  return `${routeId.trim()}::${conceptId.trim()}`
}

function hashText(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

export function seedQuestion(title: string): string {
  return `请用普通概念讲解说明「${title.trim()}」。这是该概念的首次回复，不要改写成问博主。`
}

export function createCanonicalAnswerStore() {
  const records = new Map<string, CanonicalAnswer>()
  const inflight = new Map<string, Promise<CanonicalEnsureResult>>()

  const get = (routeId: string, conceptId: string): CanonicalAnswer | undefined => {
    return records.get(scopeKey(routeId, conceptId))
  }

  const ensure = (input: {
    routeId: string
    conceptId: string
    title: string
    generate: CanonicalGenerate
  }): Promise<CanonicalEnsureResult> => {
    const routeId = input.routeId.trim()
    const conceptId = input.conceptId.trim()
    const title = input.title.trim()
    if (!routeId || !conceptId || !title) {
      return Promise.resolve({
        kind: 'failed',
        code: 'PROVIDER_INVALID',
        message: '首次回复需要明确的路线、概念和标题。',
      })
    }
    const key = scopeKey(routeId, conceptId)
    const existing = records.get(key)
    if (existing) return Promise.resolve({ kind: 'completed', answer: existing, reused: true })
    const pending = inflight.get(key)
    if (pending) return pending

    const run = (async (): Promise<CanonicalEnsureResult> => {
      const generated = await input.generate({
        question: seedQuestion(title),
        topic: title,
      })
      if (generated.kind !== 'completed' || !generated.text.trim()) {
        return {
          kind: 'failed',
          code: 'PROVIDER_UNAVAILABLE',
          message: generated.kind === 'failed' ? generated.message : '首次回复没有可用正文，不能 settle。',
        }
      }
      const raced = records.get(key)
      if (raced) return { kind: 'completed', answer: raced, reused: true }
      const answer: CanonicalAnswer = {
        routeId,
        conceptId,
        text: generated.text.trim(),
        contentHash: hashText(generated.text.trim()),
        evidenceCount: generated.evidenceCount,
      }
      records.set(key, answer)
      return { kind: 'completed', answer, reused: false }
    })().finally(() => {
      inflight.delete(key)
    })

    inflight.set(key, run)
    return run
  }

  return { get, ensure }
}

export type CanonicalAnswerStore = ReturnType<typeof createCanonicalAnswerStore>
