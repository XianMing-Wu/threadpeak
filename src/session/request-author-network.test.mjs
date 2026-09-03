import assert from 'node:assert/strict'
import test from 'node:test'
import { requestAuthorNetwork } from './request-author-network.ts'

function jsonResponse(status, value) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(value),
  }
}

test('author network empty list is not an unavailable fake page', async () => {
  const result = await requestAuthorNetwork({
    fetch: async (url) => {
      if (url === '/api/ready') return jsonResponse(200, { ready: true })
      return jsonResponse(200, { kind: 'list', authors: [] })
    },
  })
  assert.equal(result.kind, 'list')
  assert.equal(result.authors.length, 0)
})

test('author network lists enrolled authors and drops Liu Kanshan', async () => {
  const result = await requestAuthorNetwork({
    fetch: async (url) => {
      if (url === '/api/ready') return jsonResponse(200, { ready: true })
      return jsonResponse(200, {
        kind: 'list',
        authors: [
          { authorId: 'a', authorName: '作者甲', weight: 'high', question: '线性映射为什么保持加法？' },
          { authorId: 'liu', authorName: '刘看山', weight: 'low', question: '直答' },
        ],
      })
    },
  })
  assert.equal(result.kind, 'list')
  assert.equal(result.authors.length, 1)
  assert.equal(result.authors[0].weight, 'high')
})
