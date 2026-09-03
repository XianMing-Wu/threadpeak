import assert from 'node:assert/strict'
import test from 'node:test'
import { createCompositionApp } from '../http.ts'
import { createFollowUpOrchestrator } from './orchestrator.ts'

const okConfig = {
  ok: true,
  config: {
    zhihuAccessSecret: 'secret',
    zhihuApiBaseUrl: 'https://developer.zhihu.com',
    deepseekApiKey: 'key',
    deepseekBaseUrl: 'https://api.deepseek.com',
    deepseekModelName: 'deepseek-chat',
  },
}

const payload = {
  routeId: 'lp-http',
  conceptId: 'n-linear-map',
  conversationId: 'c-1',
  question: '举个例子',
  hostNodeId: 'root',
  quote: { nodeId: 'root', text: '首轮', messageId: 'm-root' },
  neighborhood: {
    host: { nodeId: 'root', title: '线性映射', content: '首轮', annotations: [] },
    siblings: [],
    predecessors: [],
    successors: [],
    edges: [],
  },
  messages: [{ messageId: 'm-root', role: 'assistant', content: '首轮', annotations: [] }],
}

function eventsOf(body) {
  return String(body).split('\n').map((line) => line.trim()).filter(Boolean).map((line) => JSON.parse(line))
}

test('follow-up stream returns G2 text and G1 grow together on dual success', async () => {
  const followUp = createFollowUpOrchestrator({
    async invokeStructured() {
      return {
        kind: 'completed',
        agentId: 'G1',
        value: { relation: 'parallel', title: '例子', edgeExplanation: '接下来看一个例子。' },
        compressed: false,
      }
    },
    async invokeText() {
      return { kind: 'completed', agentId: 'G2', text: '投影是一个例子。', compressed: false }
    },
  })
  const app = await createCompositionApp({
    config: okConfig,
    http: async () => ({ ok: false, status: 503, text: async () => '' }),
    followUp,
  })
  const posted = await app.inject({
    method: 'POST',
    url: '/api/learning/follow-up',
    headers: { 'content-type': 'application/json' },
    payload,
  })
  assert.equal(posted.statusCode, 200)
  const events = eventsOf(posted.body)
  const completed = events.find((item) => item.kind === 'completed')
  assert.equal(completed.text, '投影是一个例子。')
  assert.equal(completed.grow.relation, 'parallel')
  assert.equal(completed.hostNodeId, 'root')
  await app.close()
})

test('follow-up empty question fails closed', async () => {
  const followUp = createFollowUpOrchestrator({
    async invokeStructured() { throw new Error('should not run') },
    async invokeText() { throw new Error('should not run') },
  })
  const app = await createCompositionApp({
    config: okConfig,
    http: async () => ({ ok: false, status: 503, text: async () => '' }),
    followUp,
  })
  const posted = await app.inject({
    method: 'POST',
    url: '/api/learning/follow-up',
    headers: { 'content-type': 'application/json' },
    payload: { ...payload, question: '' },
  })
  const events = eventsOf(posted.body)
  const failed = events.find((item) => item.kind === 'failed')
  assert.equal(failed.code, 'PROVIDER_INVALID')
  await app.close()
})
