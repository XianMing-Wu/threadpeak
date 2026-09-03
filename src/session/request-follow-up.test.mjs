import assert from 'node:assert/strict'
import test from 'node:test'
import { requestFollowUp } from './request-follow-up.ts'

test('follow-up stream keeps G2 text when G1 is missing', async () => {
  const encoder = new TextEncoder()
  const result = await requestFollowUp({
    routeId: 'lp-1',
    conceptId: 'n-1',
    conversationId: 'c-1',
    question: '举个例子',
    hostNodeId: 'root',
    neighborhood: { host: { nodeId: 'root', title: '线性映射', content: '正文', annotations: [] } },
    messages: [],
    fetch: async (url) => {
      if (String(url).includes('/api/ready')) {
        return { ok: true, status: 200, text: async () => JSON.stringify({ ready: true }) }
      }
      return {
        ok: true,
        status: 200,
        text: async () => '',
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(`${JSON.stringify({ kind: 'delta', text: '投影。' })}\n`))
            controller.enqueue(encoder.encode(`${JSON.stringify({ kind: 'completed', text: '投影。', hostNodeId: 'root', grow: null })}\n`))
            controller.close()
          },
        }),
      }
    },
  })
  assert.equal(result.kind, 'completed')
  assert.equal(result.text, '投影。')
  assert.equal(result.grow, null)
})

test('follow-up dual success keeps G1 relation', async () => {
  const encoder = new TextEncoder()
  const result = await requestFollowUp({
    routeId: 'lp-1',
    conceptId: 'n-1',
    conversationId: 'c-1',
    question: '举个例子',
    hostNodeId: 'root',
    neighborhood: { host: { nodeId: 'root', title: '线性映射', content: '正文', annotations: [] } },
    messages: [],
    fetch: async (url) => {
      if (String(url).includes('/api/ready')) {
        return { ok: true, status: 200, text: async () => JSON.stringify({ ready: true }) }
      }
      return {
        ok: true,
        status: 200,
        text: async () => '',
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(`${JSON.stringify({
              kind: 'completed',
              text: '投影。',
              hostNodeId: 'root',
              grow: { relation: 'parallel', title: '投影例子', edgeExplanation: '接下来看投影。' },
            })}\n`))
            controller.close()
          },
        }),
      }
    },
  })
  assert.equal(result.kind, 'completed')
  assert.equal(result.grow.relation, 'parallel')
})
