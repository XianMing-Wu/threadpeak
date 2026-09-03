import { createHash } from 'node:crypto'
import type { AgentFailureCode, L0aAngle, StructuredAgentId, StructuredInvokeResult, TextInvokeResult, ThinkingDepth } from '../agent-runtime/types.ts'
import type { L0bOutput } from '../agent-runtime/schemas.ts'
import { L0A_ANGLES } from '../agent-runtime/types.ts'
import type { CanonicalAnswer } from '../knowledge/canonical-answer.ts'
import type { KnowledgeGraphSnapshot } from '../knowledge/graph-surgeon.ts'
import type { PublishedConcept } from '../path-generation/orchestrator.ts'

export type ConceptSnapshot = {
  conceptId: string
  title: string
  hasDispute: boolean
  detailedDescription: string
  attachmentSourceIds: readonly string[]
}

export type FirstLearningRecord = {
  answer: CanonicalAnswer
  graph: KnowledgeGraphSnapshot
}

export type FirstLearningResult =
  | { kind: 'completed'; reused: boolean; answer: CanonicalAnswer; graph: KnowledgeGraphSnapshot }
  | { kind: 'failed'; code: AgentFailureCode; message: string }

export type FirstLearningInvokeStructured = <T>(
  agentId: StructuredAgentId,
  context: unknown,
  options?: { thinkingDepth?: ThinkingDepth },
) => Promise<StructuredInvokeResult<T>>

export type FirstLearningInvokeText = (
  agentId: 'L0a',
  context: unknown,
  options?: { thinkingDepth?: ThinkingDepth; angle: L0aAngle },
) => Promise<TextInvokeResult>

function scopeKey(routeId: string, conceptId: string): string {
  return `${routeId.trim()}::${conceptId.trim()}`
}

function hashText(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

function graphIdOf(routeId: string, conceptId: string): string {
  const digest = createHash('sha256').update(scopeKey(routeId, conceptId), 'utf8').digest('hex')
  return `kg_${digest.slice(0, 32)}`
}

function settle(input: {
  routeId: string
  conceptId: string
  title: string
  text: string
}): FirstLearningRecord {
  const text = input.text.trim()
  const contentHash = hashText(text)
  const answer: CanonicalAnswer = {
    routeId: input.routeId,
    conceptId: input.conceptId,
    text,
    contentHash,
    evidenceCount: 0,
  }
  const graph: KnowledgeGraphSnapshot = {
    graphId: graphIdOf(input.routeId, input.conceptId),
    routeId: input.routeId,
    conceptId: input.conceptId,
    canonicalContentHash: contentHash,
    revision: 1,
    root: {
      nodeId: 'root',
      title: input.title,
      role: 'root',
      canonicalContentHash: contentHash,
    },
  }
  return { answer, graph }
}

function resolveConcept(input: {
  routeId: string
  conceptId: string
  title?: string
  hasDispute?: boolean
  detailedDescription?: string
  attachmentSourceIds?: readonly string[]
  lookup?: (routeId: string, conceptId: string) => PublishedConcept | undefined
}): ConceptSnapshot | undefined {
  const fromRoute = input.lookup?.(input.routeId, input.conceptId)
  if (fromRoute) return fromRoute
  const title = input.title?.trim() ?? ''
  const detailedDescription = input.detailedDescription?.trim() ?? ''
  if (!title || !detailedDescription) return undefined
  return {
    conceptId: input.conceptId,
    title,
    hasDispute: input.hasDispute === true,
    detailedDescription,
    attachmentSourceIds: input.attachmentSourceIds ?? [],
  }
}

export function createFirstLearningStore() {
  const records = new Map<string, FirstLearningRecord>()
  const inflight = new Map<string, Promise<FirstLearningResult>>()
  return {
    get(routeId: string, conceptId: string): FirstLearningRecord | undefined {
      return records.get(scopeKey(routeId, conceptId))
    },
    getCanonical(routeId: string, conceptId: string): CanonicalAnswer | undefined {
      return records.get(scopeKey(routeId, conceptId))?.answer
    },
    getGraph(routeId: string, conceptId: string): KnowledgeGraphSnapshot | undefined {
      return records.get(scopeKey(routeId, conceptId))?.graph
    },
    put(record: FirstLearningRecord) {
      records.set(scopeKey(record.answer.routeId, record.answer.conceptId), record)
    },
    inflight,
  }
}

export function createFirstLearningOrchestrator(ports: {
  invokeStructured: FirstLearningInvokeStructured
  invokeText: FirstLearningInvokeText
  lookupConcept?: (routeId: string, conceptId: string) => PublishedConcept | undefined
  store?: ReturnType<typeof createFirstLearningStore>
}) {
  const store = ports.store ?? createFirstLearningStore()

  const enter = (input: {
    routeId: string
    conceptId: string
    title?: string
    hasDispute?: boolean
    detailedDescription?: string
    attachmentSourceIds?: readonly string[]
    thinkingDepth?: ThinkingDepth
  }): Promise<FirstLearningResult> => {
    const routeId = input.routeId.trim()
    const conceptId = input.conceptId.trim()
    if (!routeId || !conceptId) {
      return Promise.resolve({
        kind: 'failed',
        code: 'PROVIDER_INVALID',
        message: '首次学习需要明确的路线和概念。',
      })
    }
    const key = scopeKey(routeId, conceptId)
    const existing = store.get(routeId, conceptId)
    if (existing) {
      return Promise.resolve({ kind: 'completed', reused: true, answer: existing.answer, graph: existing.graph })
    }
    const pending = store.inflight.get(key)
    if (pending) return pending

    const run = (async (): Promise<FirstLearningResult> => {
      const raced = store.get(routeId, conceptId)
      if (raced) return { kind: 'completed', reused: true, answer: raced.answer, graph: raced.graph }
      const concept = resolveConcept({ ...input, routeId, conceptId, lookup: ports.lookupConcept })
      if (!concept) {
        return {
          kind: 'failed',
          code: 'PROVIDER_INVALID',
          message: '没有已发布概念的详细描述，不能生成首次回复。学习阶段不读取附件原件。',
        }
      }
      const thinkingDepth = input.thinkingDepth === 'deep' ? 'deep' : 'fast'
      const base = {
        concept: {
          conceptId: concept.conceptId,
          title: concept.title,
          hasDispute: concept.hasDispute,
          detailedDescription: concept.detailedDescription,
          attachmentSourceIds: concept.attachmentSourceIds,
        },
      }
      const invokeL0a = (angle: L0aAngle) => ports.invokeText('L0a', { ...base, angle }, { thinkingDepth, angle })
      const firstWave = await Promise.all(L0A_ANGLES.map((angle) => invokeL0a(angle)))
      const answers = [...firstWave]
      for (let index = 0; index < answers.length; index += 1) {
        if (answers[index]?.kind !== 'failed') continue
        await new Promise((resolve) => setTimeout(resolve, 800))
        answers[index] = await invokeL0a(L0A_ANGLES[index]!)
      }
      const [concrete, dispute, pitfalls] = answers
      if (concrete.kind === 'failed' || dispute.kind === 'failed' || pitfalls.kind === 'failed') {
        const failed = [concrete, dispute, pitfalls].find((item) => item.kind === 'failed')
        return {
          kind: 'failed',
          code: failed && failed.kind === 'failed' ? failed.code : 'PROVIDER_UNAVAILABLE',
          message: failed && failed.kind === 'failed' ? failed.message : '三路直答没有全部成功。',
        }
      }
      const organized = await ports.invokeStructured<L0bOutput>('L0b', {
        conceptId: concept.conceptId,
        title: concept.title,
        detailedDescription: concept.detailedDescription,
        directAnswers: [
          { angle: 'concrete_explanation', content: concrete.text },
          { angle: 'dispute', content: dispute.text },
          { angle: 'pitfalls', content: pitfalls.text },
        ],
      }, { thinkingDepth })
      if (organized.kind === 'failed') {
        return { kind: 'failed', code: organized.code, message: organized.message }
      }
      const already = store.get(routeId, conceptId)
      if (already) return { kind: 'completed', reused: true, answer: already.answer, graph: already.graph }
      const record = settle({
        routeId,
        conceptId,
        title: concept.title,
        text: organized.value.content,
      })
      store.put(record)
      return { kind: 'completed', reused: false, answer: record.answer, graph: record.graph }
    })().finally(() => {
      store.inflight.delete(key)
    })

    store.inflight.set(key, run)
    return run
  }

  return {
    get: (routeId: string, conceptId: string) => store.get(routeId, conceptId),
    getCanonical: (routeId: string, conceptId: string) => store.getCanonical(routeId, conceptId),
    getGraph: (routeId: string, conceptId: string) => store.getGraph(routeId, conceptId),
    enter,
  }
}

export type FirstLearningOrchestrator = ReturnType<typeof createFirstLearningOrchestrator>
