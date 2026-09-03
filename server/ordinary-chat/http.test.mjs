import assert from 'node:assert/strict'
import test from 'node:test'
import { createCompositionApp } from '../http.ts'
import { createOrdinaryChatOrchestrator } from './orchestrator.ts'

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
  currentMessage: '什么是线性映射？',
  conversation: [
    { messageId: 'm-0', role: 'user', kind: 'text', content: '先讲定义' },
    { messageId: 'm-1', role: 'assistant', kind: 'text', content: '定义是保加法与数乘。' },
  ],
  attachments: [{ sourceId: 'att-1', fileName: 'note.txt', content: '讲义' }],
}

function eventsOf(body) {
  return String(body).split('\n').map((line) => line.trim()).filter(Boolean).map((line) => JSON.parse(line))
}

test('POST /api/answers calls R5 with conversation and attachments', async () => {
  const calls = []
  const ordinaryChat = createOrdinaryChatOrchestrator({
    async invokeText(agentId, context) {
      calls.push({ agentId, context })
      return { kind: 'completed', agentId: 'R5', text: '线性映射保持运算。', compressed: false }
    },
  })
  const app = await createCompositionApp({
    config: okConfig,
    http: async () => ({ ok: false, status: 503, text: async () => '' }),
    ordinaryChat,
  })
  const posted = await app.inject({
    method: 'POST',
    url: '/api/answers',
    headers: { 'content-type': 'application/json' },
    payload,
  })
  assert.equal(posted.statusCode, 200)
  const body = JSON.parse(posted.body)
  assert.equal(body.kind, 'completed')
  assert.equal(body.text, '线性映射保持运算。')
  assert.equal(calls[0].agentId, 'R5')
  assert.equal(calls[0].context.currentMessage, '什么是线性映射？')
  assert.equal(calls[0].context.conversation.length, 2)
  assert.equal(calls[0].context.attachments[0].sourceId, 'att-1')
  await app.close()
})

test('POST /api/answers/stream settles R5 text without Zhihu search stages', async () => {
  const ordinaryChat = createOrdinaryChatOrchestrator({
    async invokeText() {
      return { kind: 'completed', agentId: 'R5', text: '投影是一个例子。', compressed: false }
    },
  })
  const app = await createCompositionApp({
    config: okConfig,
    http: async () => ({ ok: false, status: 503, text: async () => '' }),
    ordinaryChat,
  })
  const posted = await app.inject({
    method: 'POST',
    url: '/api/answers/stream',
    headers: { 'content-type': 'application/json' },
    payload,
  })
  assert.equal(posted.statusCode, 200)
  const events = eventsOf(posted.body)
  assert.equal(events[0].kind, 'status')
  assert.equal(events[0].stage, 'compose')
  assert.ok(!events.some((item) => item.stage === 'search' || item.kind === 'grow'))
  const completed = events.find((item) => item.kind === 'completed')
  assert.equal(completed.text, '投影是一个例子。')
  await app.close()
})

test('missing ordinary-chat orchestrator fails closed', async () => {
  const app = await createCompositionApp({
    config: okConfig,
    http: async () => ({ ok: false, status: 503, text: async () => '' }),
  })
  const posted = await app.inject({
    method: 'POST',
    url: '/api/answers',
    headers: { 'content-type': 'application/json' },
    payload: { currentMessage: '什么是线性映射？' },
  })
  assert.equal(posted.statusCode, 503)
  assert.equal(JSON.parse(posted.body).kind, 'failed')
  await app.close()
})
