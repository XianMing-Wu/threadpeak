import assert from 'node:assert/strict'
import test from 'node:test'
import { requestAuthorSearch } from './request-author-search.ts'

function jsonResponse(status, value) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(value),
  }
}

test('author search surfaces live network-unavailable instead of a generic fallback', async () => {
  const result = await requestAuthorSearch({
    query: '线性代数',
    fetch: async (url) => {
      if (url === '/api/ready') return jsonResponse(200, { ready: true })
      return jsonResponse(503, {
        kind: 'failed',
        code: 'NETWORK_UNAVAILABLE',
        message: '博主网络还没有接通真实的关系投影。',
      })
    },
  })
  assert.equal(result.kind, 'unavailable')
  assert.match(result.message, /关系投影/)
})
