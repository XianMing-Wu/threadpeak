import assert from 'node:assert/strict'
import test from 'node:test'
import { requestOrdinaryAnswer } from './request-ordinary-answer.ts'

function jsonResponse(status, value) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(value),
  }
}

test('live 503 surfaces the provider message instead of a generic fallback', async () => {
  const result = await requestOrdinaryAnswer({
    currentMessage: '什么是线性映射？',
    fetch: async (url) => {
      if (url === '/api/ready') return jsonResponse(200, { ready: true })
      return jsonResponse(503, { kind: 'failed', code: 'PROVIDER_UNAVAILABLE', message: '模型服务不可用，不能生成这次回答。' })
    },
  })
  assert.equal(result.kind, 'unavailable')
  assert.match(result.message, /模型服务不可用/)
})

test('answer streams accumulate R5 text and do not expect Zhihu search stages', async () => {
  const chunks = []
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`${JSON.stringify({ kind: 'status', stage: 'compose' })}\n`))
      controller.enqueue(encoder.encode(`${JSON.stringify({ kind: 'delta', text: '线性映射保持运算。' })}\n`))
      controller.enqueue(encoder.encode(`${JSON.stringify({ kind: 'completed', text: '线性映射保持运算。' })}\n`))
      controller.close()
    },
  })
  const { requestOrdinaryAnswerStream } = await import('./request-ordinary-answer.ts')
  let posted
  const result = await requestOrdinaryAnswerStream({
    currentMessage: '什么是线性映射？',
    conversation: [{ messageId: 'm-0', role: 'user', kind: 'text', content: '先讲定义' }],
    attachments: [{ sourceId: 'att-1', fileName: 'note.txt', content: '讲义' }],
    fetch: async (url, init) => {
      if (String(url).includes('/api/ready')) {
        return { ok: true, status: 200, text: async () => JSON.stringify({ ready: true }) }
      }
      posted = JSON.parse(String(init?.body ?? '{}'))
      return { ok: true, status: 200, text: async () => '', body: stream }
    },
    onDelta: (text) => chunks.push(text),
  })
  assert.equal(result.kind, 'completed')
  assert.equal(result.text, '线性映射保持运算。')
  assert.deepEqual(chunks, ['线性映射保持运算。', '线性映射保持运算。'])
  assert.equal(posted.currentMessage, '什么是线性映射？')
  assert.equal(posted.conversation[0].messageId, 'm-0')
  assert.equal(posted.attachments[0].sourceId, 'att-1')
})

test('completed live answers keep the model text', async () => {
  const result = await requestOrdinaryAnswer({
    currentMessage: '什么是线性映射？',
    fetch: async (url) => {
      if (url === '/api/ready') return jsonResponse(200, { ready: true })
      return jsonResponse(200, { kind: 'completed', text: '线性映射保持加法和数乘。' })
    },
  })
  assert.equal(result.kind, 'completed')
  assert.match(result.text, /加法和数乘/)
})
