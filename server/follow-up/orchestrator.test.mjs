import assert from 'node:assert/strict'
import test from 'node:test'
import { createFollowUpOrchestrator } from './orchestrator.ts'

const neighborhood = {
  host: {
    nodeId: 'root',
    title: '线性映射',
    content: '线性映射同时保持加法和数乘。',
    annotations: [],
  },
  siblings: [],
  predecessors: [],
  successors: [],
  edges: [],
}

const base = {
  routeId: 'lp-route',
  conceptId: 'n-linear-map',
  conversationId: 'c-1',
  question: '举个具体例子',
  hostNodeId: 'root',
  neighborhood,
  messages: [{
    messageId: 'm-root',
    role: 'assistant',
    content: '线性映射同时保持加法和数乘。',
    annotations: [],
  }],
  quote: { nodeId: 'root', text: '线性映射同时保持加法和数乘。', messageId: 'm-root' },
}

function orchestrator(overrides = {}) {
  const calls = []
  const started = []
  let release
  const gate = new Promise((resolve) => { release = resolve })
  const api = createFollowUpOrchestrator({
    async invokeStructured(agentId, context) {
      calls.push({ agentId, context })
      started.push(agentId)
      if (started.length === 2) release()
      await gate
      if (overrides.failG1) {
        return { kind: 'failed', code: 'OUTPUT_INVALID', message: 'G1 失败', agentId }
      }
      return {
        kind: 'completed',
        agentId,
        value: {
          relation: 'parallel',
          title: '一个例子',
          edgeExplanation: '这个概念理解之后，接下来就可以看一个同层例子。',
        },
        compressed: false,
      }
    },
    async invokeText(agentId, context) {
      calls.push({ agentId, context })
      started.push(agentId)
      if (started.length === 2) release()
      await gate
      if (overrides.failG2) {
        return { kind: 'failed', code: 'PROVIDER_UNAVAILABLE', message: 'G2 失败', agentId }
      }
      return { kind: 'completed', agentId, text: '比如平面上的投影。', compressed: false }
    },
  })
  return { api, calls, started }
}

test('G1 and G2 start together and G2 context stays on this conversation', { timeout: 5_000 }, async () => {
  const { api, calls, started } = orchestrator()
  const result = await api.ask(base)
  assert.equal(result.kind, 'completed')
  assert.deepEqual(new Set(started), new Set(['G1', 'G2']))
  const g1 = calls.find((item) => item.agentId === 'G1')
  const g2 = calls.find((item) => item.agentId === 'G2')
  assert.equal(g1.context.host.nodeId, 'root')
  assert.equal(g1.context.question.text, '举个具体例子')
  assert.equal(g1.context.attachments, undefined)
  assert.equal(g2.context.conversationId, 'c-1')
  assert.equal(g2.context.currentQuestion, '举个具体例子')
  assert.equal(g2.context.messages[0].content, '线性映射同时保持加法和数乘。')
  assert.equal(result.grow.relation, 'parallel')
  assert.equal(result.text, '比如平面上的投影。')
})

test('G2 failure does not grow the graph', async () => {
  const { api } = orchestrator({ failG2: true })
  const result = await api.ask(base)
  assert.equal(result.kind, 'failed')
})

test('G1 failure with G2 success returns the reply and no grow', async () => {
  const { api } = orchestrator({ failG1: true })
  const result = await api.ask(base)
  assert.equal(result.kind, 'completed')
  assert.equal(result.text, '比如平面上的投影。')
  assert.equal(result.grow, null)
})

test('empty question or missing host fails closed without calling agents', async () => {
  const { api, calls } = orchestrator()
  const empty = await api.ask({ ...base, question: '  ' })
  assert.equal(empty.kind, 'failed')
  assert.equal(empty.code, 'PROVIDER_INVALID')
  const missingHost = await api.ask({ ...base, neighborhood: { host: { nodeId: '', title: '', content: '', annotations: [] } } })
  assert.equal(missingHost.kind, 'failed')
  assert.equal(calls.length, 0)
})
