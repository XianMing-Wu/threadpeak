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
