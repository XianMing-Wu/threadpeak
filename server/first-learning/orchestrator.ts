import { createHash } from 'node:crypto'
import type { AgentFailureCode, L0aAngle, StructuredAgentId, StructuredInvokeResult, TextInvokeResult, ThinkingDepth } from '../agent-runtime/types.ts'
import type { L0bOutput } from '../agent-runtime/schemas.ts'
import { ZHIHU_CONCURRENCY, mapWithConcurrency } from '../agent-runtime/concurrency.ts'
import { L0A_ANGLES } from '../agent-runtime/types.ts'
import type { CanonicalAnswer } from '../knowledge/canonical-answer.ts'
import type { KnowledgeGraphSnapshot } from '../knowledge/graph-surgeon.ts'
import type { PublishedConcept } from '../path-generation/orchestrator.ts'
import { streamingJsonField } from '../agent-runtime/stream-json-field.ts'
import {
  agentStep,
  searchStep,
  thinkStep,
  type ProcessStep,
} from '../../src/process-trace.ts'

const L0A_EXTRA: Record<L0aAngle, string> = {
  concrete_explanation: '具体讲解',
  dispute: '是否争议',
  pitfalls: '踩坑点',
}

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
  trace: ProcessStep[]
}

export type FirstLearningResult =
  | { kind: 'completed'; reused: boolean; answer: CanonicalAnswer; graph: KnowledgeGraphSnapshot; trace: ProcessStep[] }
  | { kind: 'failed'; code: AgentFailureCode; message: string; trace: ProcessStep[] }
  | { kind: 'running'; trace: ProcessStep[]; draftText?: string }

export type FirstLearningPeek =
  | { kind: 'completed'; reused: true; answer: CanonicalAnswer; graph: KnowledgeGraphSnapshot; trace: ProcessStep[] }
  | { kind: 'running'; trace: ProcessStep[]; draftText?: string }
  | { kind: 'failed'; code: AgentFailureCode; message: string; trace: ProcessStep[] }
  | { kind: 'missing' }

export type FirstLearningInvokeStructured = <T>(
  agentId: StructuredAgentId,
  context: unknown,
  options?: { thinkingDepth?: ThinkingDepth; onReasoning?: (text: string) => void; onText?: (text: string) => void },
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
  return { answer, graph, trace: [] }
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
  const traces = new Map<string, ProcessStep[]>()
  const drafts = new Map<string, string>()
  const lastFail = new Map<string, { code: AgentFailureCode; message: string }>()
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
    traces,
    drafts,
    lastFail,
  }
}

export function createFirstLearningOrchestrator(ports: {
  invokeStructured: FirstLearningInvokeStructured
  invokeText: FirstLearningInvokeText
  lookupConcept?: (routeId: string, conceptId: string) => PublishedConcept | undefined
  store?: ReturnType<typeof createFirstLearningStore>
}) {
  const store = ports.store ?? createFirstLearningStore()

  const traceOf = (key: string) => store.traces.get(key) ?? []

  const beginStep = (key: string, step: ProcessStep) => {
    const current = store.traces.get(key) ?? []
    const existing = current.find((item) => item.id === step.id)
    if (existing) {
      existing.status = 'running'
      if (step.title !== undefined) existing.title = step.title
      if (step.extra !== undefined) existing.extra = step.extra
      if (step.thought !== undefined) existing.thought = step.thought
      store.traces.set(key, current)
      return
    }
    store.traces.set(key, [...current, { ...step, status: 'running' }])
  }

  const finishStep = (key: string, id: string, status: 'done' | 'failed' = 'done') => {
    const current = store.traces.get(key) ?? []
    const existing = current.find((item) => item.id === id)
    if (existing) existing.status = status
    store.traces.set(key, current)
  }

  const peek = (routeId: string, conceptId: string): FirstLearningPeek => {
    const found = store.get(routeId, conceptId)
    if (found) {
      return {
        kind: 'completed',
        reused: true,
        answer: found.answer,
        graph: found.graph,
        trace: found.trace ?? [],
      }
    }
    const key = scopeKey(routeId, conceptId)
    if (store.inflight.has(key)) {
      const draftText = store.drafts.get(key)
      return { kind: 'running', trace: traceOf(key), ...(draftText ? { draftText } : {}) }
    }
    const failed = store.lastFail.get(key)
    if (failed) return { kind: 'failed', ...failed, trace: traceOf(key) }
    return { kind: 'missing' }
  }

  const enter = (input: {
    routeId: string
    conceptId: string
    title?: string
    hasDispute?: boolean
    detailedDescription?: string
    attachmentSourceIds?: readonly string[]
    thinkingDepth?: ThinkingDepth
    wait?: boolean
  }): Promise<FirstLearningResult> => {
    const routeId = input.routeId.trim()
    const conceptId = input.conceptId.trim()
    if (!routeId || !conceptId) {
      return Promise.resolve({
        kind: 'failed',
        code: 'PROVIDER_INVALID',
        message: '首次学习需要明确的路线和概念。',
        trace: [],
      })
    }
    const key = scopeKey(routeId, conceptId)
    const existing = store.get(routeId, conceptId)
    if (existing) {
      return Promise.resolve({
        kind: 'completed',
        reused: true,
        answer: existing.answer,
        graph: existing.graph,
        trace: existing.trace ?? [],
      })
    }
    const pending = store.inflight.get(key)
    if (pending) {
      if (input.wait === false) {
        const draftText = store.drafts.get(key)
        return Promise.resolve({ kind: 'running', trace: traceOf(key), ...(draftText ? { draftText } : {}) })
      }
      return pending
    }
    const concept = resolveConcept({ ...input, routeId, conceptId, lookup: ports.lookupConcept })
    if (!concept) {
      const failed = {
        kind: 'failed' as const,
        code: 'PROVIDER_INVALID' as const,
        message: '没有已发布概念的详细描述，不能生成首次回复。学习阶段不读取附件原件。',
        trace: traceOf(key),
      }
      store.lastFail.set(key, { code: failed.code, message: failed.message })
      return Promise.resolve(failed)
    }

    store.inflight.set(key, new Promise(() => {}))
    const run = (async (): Promise<FirstLearningResult> => {
      const raced = store.get(routeId, conceptId)
      if (raced) {
        return { kind: 'completed', reused: true, answer: raced.answer, graph: raced.graph, trace: raced.trace ?? [] }
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
      const invokeL0a = async (angle: L0aAngle, index = L0A_ANGLES.indexOf(angle)) => {
        const id = `l0a-${angle}`
        const pending = ports.invokeText('L0a', { ...base, angle }, { thinkingDepth, angle })
        if (index > 0) await new Promise((resolve) => setTimeout(resolve, index * 200))
        beginStep(key, searchStep(id, L0A_EXTRA[angle], 'running', '知乎直答'))
        const result = await pending
        finishStep(key, id, result.kind === 'failed' ? 'failed' : 'done')
        return result
      }
      const firstWave = await mapWithConcurrency(L0A_ANGLES, ZHIHU_CONCURRENCY, (angle, index) => invokeL0a(angle, index))
      const answers = [...firstWave]
      for (let index = 0; index < answers.length; index += 1) {
        if (answers[index]?.kind !== 'failed') continue
        await new Promise((resolve) => setTimeout(resolve, 800))
        answers[index] = await invokeL0a(L0A_ANGLES[index]!)
      }
      const [concrete, dispute, pitfalls] = answers
      if (concrete.kind === 'failed' || dispute.kind === 'failed' || pitfalls.kind === 'failed') {
        const failedItem = [concrete, dispute, pitfalls].find((item) => item.kind === 'failed')
        const failed = {
          kind: 'failed' as const,
          code: failedItem && failedItem.kind === 'failed' ? failedItem.code : 'PROVIDER_UNAVAILABLE' as const,
          message: failedItem && failedItem.kind === 'failed' ? failedItem.message : '三路直答没有全部成功。',
          trace: traceOf(key),
        }
        store.lastFail.set(key, { code: failed.code, message: failed.message })
        return failed
      }
      beginStep(key, agentStep('l0b', '组织第一段讲解'))
      const organized = await ports.invokeStructured<L0bOutput>('L0b', {
        conceptId: concept.conceptId,
        title: concept.title,
        detailedDescription: concept.detailedDescription,
        directAnswers: [
          { angle: 'concrete_explanation', content: concrete.text },
          { angle: 'dispute', content: dispute.text },
          { angle: 'pitfalls', content: pitfalls.text },
        ],
      }, {
        thinkingDepth,
        onText: (raw) => {
          const draft = streamingJsonField(raw, 'content')
          if (draft) store.drafts.set(key, draft)
        },
        onReasoning: thinkingDepth === 'deep'
          ? (text) => {
            if (!text.trim()) return
            beginStep(key, thinkStep('l0b-think'))
            const think = traceOf(key).find((item) => item.id === 'l0b-think')
            if (think) think.thought = text
          }
          : undefined,
      })
      if (organized.kind === 'failed') {
        const think = traceOf(key).find((item) => item.id === 'l0b-think')
        finishStep(key, 'l0b-think', think?.thought?.trim() ? 'done' : 'failed')
        finishStep(key, 'l0b', 'failed')
        store.drafts.delete(key)
        const failed = { kind: 'failed' as const, code: organized.code, message: organized.message, trace: traceOf(key) }
        store.lastFail.set(key, { code: failed.code, message: failed.message })
        return failed
      }
      finishStep(key, 'l0b-think')
      finishStep(key, 'l0b')
      const already = store.get(routeId, conceptId)
      if (already) {
        return { kind: 'completed', reused: true, answer: already.answer, graph: already.graph, trace: already.trace ?? traceOf(key) }
      }
      const record = settle({
        routeId,
        conceptId,
        title: concept.title,
        text: organized.value.content,
      })
      record.trace = traceOf(key)
      store.put(record)
      store.drafts.delete(key)
      store.lastFail.delete(key)
      return { kind: 'completed', reused: false, answer: record.answer, graph: record.graph, trace: record.trace }
    })().finally(() => {
      store.inflight.delete(key)
    })

    store.inflight.set(key, run)
    if (input.wait === false) {
      const draftText = store.drafts.get(key)
      return Promise.resolve({ kind: 'running', trace: traceOf(key), ...(draftText ? { draftText } : {}) })
    }
    return run
  }

  return {
    get: (routeId: string, conceptId: string) => store.get(routeId, conceptId),
    getCanonical: (routeId: string, conceptId: string) => store.getCanonical(routeId, conceptId),
    getGraph: (routeId: string, conceptId: string) => store.getGraph(routeId, conceptId),
    peek,
    enter,
  }
}

export type FirstLearningOrchestrator = ReturnType<typeof createFirstLearningOrchestrator>
