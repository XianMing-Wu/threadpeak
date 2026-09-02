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
    question: '什么是线性映射？',
    fetch: async (url) => {
      if (url === '/api/ready') return jsonResponse(200, { ready: true })
      return jsonResponse(503, { kind: 'failed', code: 'PROVIDER_UNAVAILABLE', message: '知乎检索不可用，不能生成这次回答。' })
    },
  })
  assert.equal(result.kind, 'unavailable')
  assert.match(result.message, /知乎检索不可用/)
})

test('answer streams accumulate deltas and settle the same text', async () => {
  const chunks = []
  const stages = []
  const grows = []
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`${JSON.stringify({ kind: 'status', stage: 'search' })}\n`))
      controller.enqueue(encoder.encode(`${JSON.stringify({ kind: 'status', stage: 'classify' })}\n`))
      controller.enqueue(encoder.encode(`${JSON.stringify({ kind: 'grow', grow: { kind: 'par', title: '举个例子', reason: '并列问法', mergeNodeId: null } })}\n`))
      controller.enqueue(encoder.encode(`${JSON.stringify({ kind: 'delta', text: '线性' })}\n`))
      controller.enqueue(encoder.encode(`${JSON.stringify({ kind: 'delta', text: '映射' })}\n`))
      controller.enqueue(encoder.encode(`${JSON.stringify({ kind: 'completed', text: '线性映射', evidenceCount: 2 })}\n`))
      controller.close()
    },
  })
  const { requestOrdinaryAnswerStream } = await import('./request-ordinary-answer.ts')
  const result = await requestOrdinaryAnswerStream({
    question: '什么是线性映射？',
    fetch: async (url) => {
      if (String(url).includes('/api/ready')) {
        return { ok: true, status: 200, text: async () => JSON.stringify({ ready: true }) }
      }
      return { ok: true, status: 200, text: async () => '', body: stream }
    },
    onDelta: (text) => chunks.push(text),
    onStatus: (stage) => stages.push(stage),
    onGrow: (grow) => grows.push(grow),
  })
  assert.equal(result.kind, 'completed')
  assert.equal(result.text, '线性映射')
  assert.deepEqual(chunks, ['线性', '线性映射', '线性映射'])
  assert.deepEqual(stages, ['search', 'classify'])
  assert.equal(grows[0]?.kind, 'par')
  assert.equal(result.kind === 'completed' && result.grow?.kind, 'par')
})

test('completed live answers keep the model text', async () => {
  const result = await requestOrdinaryAnswer({
    question: '什么是线性映射？',
    fetch: async (url) => {
      if (url === '/api/ready') return jsonResponse(200, { ready: true })
      return jsonResponse(200, { kind: 'completed', text: '线性映射保持加法和数乘。', evidenceCount: 2 })
    },
  })
  assert.equal(result.kind, 'completed')
  assert.match(result.text, /加法和数乘/)
})
