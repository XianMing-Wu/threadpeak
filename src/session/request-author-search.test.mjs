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
        message: '现在连不上博主搜索。请稍后再试。',
      })
    },
  })
  assert.equal(result.kind, 'unavailable')
  assert.match(result.message, /请稍后再试/)
})

test('author search maps mixed high/low/zhihu people without inventing Liu Kanshan', async () => {
  const result = await requestAuthorSearch({
    query: '线性代数',
    fetch: async (url) => {
      if (url === '/api/ready') return jsonResponse(200, { ready: true })
      return jsonResponse(200, {
        kind: 'results',
        authors: [
          { authorId: 'a', displayName: '作者甲', origin: 'high-weight' },
          { authorId: 'b', displayName: '作者乙', origin: 'zhihu' },
          { authorId: 'liu', displayName: '刘看山', origin: 'zhihu' },
        ],
      })
    },
  })
  assert.equal(result.kind, 'results')
  assert.equal(result.authors.length, 2)
  assert.equal(result.authors[0].origin, 'high-weight')
  assert.equal(result.authors[1].origin, 'zhihu')
})
