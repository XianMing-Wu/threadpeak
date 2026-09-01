import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveAuthorSearch } from './resolve-author-search.ts'

test('author search requests do not invent GraphRAG or fixed-author success', () => {
  const resolution = resolveAuthorSearch()
  assert.equal(resolution.kind, 'unavailable')
  assert.equal(resolution.reason, 'missing-author-search-provider')
  assert.match(resolution.message, /不能用本地 GraphRAG 或固定作者冒充成功/)
})
