import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveAuthorNetwork } from './resolve-author-network.ts'

test('author network views do not invent sessionStorage or constellation success', () => {
  const resolution = resolveAuthorNetwork()
  assert.equal(resolution.kind, 'unavailable')
  assert.equal(resolution.reason, 'missing-author-network-projector')
  assert.match(resolution.message, /不能用 sessionStorage 或示例星图冒充已提交网络/)
})
