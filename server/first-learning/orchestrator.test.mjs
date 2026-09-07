import assert from 'node:assert/strict'
import test from 'node:test'
import { createFirstLearningOrchestrator } from './orchestrator.ts'

const concept = {
  routeId: 'lp-route',
  conceptId: 'n-linear-map',
  title: '线性映射',
  hasDispute: true,
  detailedDescription: '讲解应偏向保加法与数乘，以及它要解决什么表示问题。',
  attachmentSourceIds: ['att-1'],
}

function orchestrator(overrides = {}) {
  const calls = []
  const started = []
  let inFlight = 0
  let maxInFlight = 0
  const api = createFirstLearningOrchestrator({
    async invokeText(_agentId, context, options) {
      calls.push({ agentId: 'L0a', angle: options.angle, context })
      started.push(options.angle)
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 15))
      inFlight -= 1
      if (overrides.failAngle === options.angle) {
        return { kind: 'failed', code: 'PROVIDER_UNAVAILABLE', message: `${options.angle} 失败`, agentId: 'L0a' }
      }
      return { kind: 'completed', agentId: 'L0a', text: `${options.angle} 正文`, compressed: false }
    },
    async invokeStructured(agentId, context) {
      calls.push({ agentId, context })
      if (overrides.failL0b) {
        return { kind: 'failed', code: 'OUTPUT_INVALID', message: 'L0b 失败', agentId }
      }
      return { kind: 'completed', agentId, value: { content: '整理后的首次回复。' }, compressed: false }
    },
    ...overrides.ports,
  })
  return { api, calls, started, getMaxInFlight: () => maxInFlight }
}

test('L0a runs all three angles with at most two Zhihu calls in flight', { timeout: 5_000 }, async () => {
  const { api, calls, started, getMaxInFlight } = orchestrator()
  const result = await api.enter(concept)
  assert.equal(result.kind, 'completed')
  assert.equal(result.reused, false)
  assert.equal(getMaxInFlight(), 2)
  assert.deepEqual(new Set(started), new Set(['concrete_explanation', 'dispute', 'pitfalls']))
  const l0b = calls.find((item) => item.agentId === 'L0b')
  assert.equal(l0b.context.title, '线性映射')
  assert.equal(l0b.context.detailedDescription, concept.detailedDescription)
  assert.deepEqual(l0b.context.directAnswers.map((item) => item.angle), ['concrete_explanation', 'dispute', 'pitfalls'])
  assert.equal(l0b.context.attachments, undefined)
  assert.doesNotMatch(JSON.stringify(calls.find((item) => item.agentId === 'L0a').context), /讲义原文|pdf/)
})

test('any L0a failure or L0b failure does not settle first answer or root', { timeout: 5_000 }, async () => {
  const failedA = orchestrator({ failAngle: 'dispute' })
  const a = await failedA.api.enter(concept)
  assert.equal(a.kind, 'failed')
  assert.equal(failedA.api.get(concept.routeId, concept.conceptId), undefined)

  const failedB = orchestrator({ failL0b: true })
  const b = await failedB.api.enter(concept)
  assert.equal(b.kind, 'failed')
  assert.equal(failedB.api.get(concept.routeId, concept.conceptId), undefined)
})

test('L0b draft text is visible while 组织第一段讲解 is still running', async () => {
  let peek
  const { api } = orchestrator({
    ports: {
      async invokeStructured(agentId, _context, options) {
        options?.onText?.('{"content":"向量')
        options?.onText?.('{"content":"向量与空间变换"}')
        assert.equal(peek().kind, 'running')
        assert.equal(peek().draftText, '向量与空间变换')
        assert.equal(peek().trace.find((step) => step.id === 'l0b')?.status, 'running')
        await new Promise((resolve) => setTimeout(resolve, 20))
        return { kind: 'completed', agentId, value: { content: '向量与空间变换' }, compressed: false }
      },
    },
  })
  peek = () => api.peek(concept.routeId, concept.conceptId)
  const running = await api.enter({ ...concept, wait: false })
  assert.equal(running.kind, 'running')
  const result = await api.enter(concept)
  assert.equal(result.kind, 'completed')
  assert.equal(result.answer.text, '向量与空间变换')
  assert.equal(peek().kind, 'completed')
  assert.equal(peek().draftText, undefined)
})

test('L0a status bars appear as each call starts, L0b only after the three answers', async () => {
  const seen = []
  let peek
  const { api } = orchestrator({
    ports: {
      async invokeText(_agentId, _context, options) {
        seen.push(peek().trace.map((step) => step.id))
        await new Promise((resolve) => setTimeout(resolve, 15))
        return { kind: 'completed', agentId: 'L0a', text: `${options.angle} 正文`, compressed: false }
      },
    },
  })
  peek = () => api.peek(concept.routeId, concept.conceptId)
  const result = await api.enter(concept)
  assert.equal(result.kind, 'completed')
  assert.ok(seen[0].every((id) => String(id).startsWith('l0a-')))
  assert.ok(seen.every((ids) => !ids.includes('l0b')))
  assert.ok(seen[0].length <= 2)
  assert.equal(result.trace.filter((step) => step.kind === 'search').length, 3)
  assert.equal(result.trace.at(-1).title, '组织第一段讲解')
  assert.ok(result.trace.every((step) => step.status === 'done'))
})

test('successful L0b settles first answer and unique root in one result', async () => {
  const { api } = orchestrator()
  const first = await api.enter(concept)
  assert.equal(first.kind, 'completed')
  assert.equal(first.answer.text, '整理后的首次回复。')
  assert.equal(first.graph.root.title, '线性映射')
  assert.equal(first.graph.root.role, 'root')
  assert.equal(first.graph.root.nodeId, 'root')
  assert.equal(first.graph.canonicalContentHash, first.answer.contentHash)
  assert.equal(first.graph.root.canonicalContentHash, first.answer.contentHash)
  assert.notEqual(first.graph.root.title, first.answer.text)
  assert.equal(first.graph.revision, 1)
})

test('re-entry and concurrent first entry reuse the same first answer and root', async () => {
  const { api, calls } = orchestrator()
  const first = api.enter(concept)
  const concurrent = api.enter(concept)
  const [left, right] = await Promise.all([first, concurrent])
  assert.equal(left.kind, 'completed')
  assert.equal(right.kind, 'completed')
  const l0aCalls = calls.filter((item) => item.agentId === 'L0a').length
  assert.equal(l0aCalls, 3)
  const second = await api.enter(concept)
  assert.equal(second.kind, 'completed')
  assert.equal(second.reused, true)
  assert.equal(second.answer.contentHash, left.answer.contentHash)
  assert.equal(second.graph.graphId, left.graph.graphId)
  assert.equal(calls.filter((item) => item.agentId === 'L0a').length, 3)
  assert.equal(calls.filter((item) => item.agentId === 'L0b').length, 1)
})

test('missing detailedDescription does not call L0a or settle', async () => {
  const { api, calls } = orchestrator()
  const result = await api.enter({ routeId: 'lp-route', conceptId: 'n-linear-map', title: '线性映射' })
  assert.equal(result.kind, 'failed')
  assert.equal(result.code, 'PROVIDER_INVALID')
  assert.equal(calls.length, 0)
  assert.equal(api.get('lp-route', 'n-linear-map'), undefined)
})

test('learning does not send attachment originals and can read published catalog', async () => {
  const { api, calls } = orchestrator({
    ports: {
      lookupConcept() {
        return {
          conceptId: 'n-linear-map',
          title: '线性映射',
          hasDispute: true,
          detailedDescription: '目录里的详细描述',
          attachmentSourceIds: ['att-1'],
        }
      },
    },
  })
  const result = await api.enter({ routeId: 'lp-route', conceptId: 'n-linear-map' })
  assert.equal(result.kind, 'completed')
  const l0a = calls.find((item) => item.agentId === 'L0a')
  assert.equal(l0a.context.concept.detailedDescription, '目录里的详细描述')
  assert.deepEqual(l0a.context.concept.attachmentSourceIds, ['att-1'])
  assert.equal(l0a.context.concept.content, undefined)
})
