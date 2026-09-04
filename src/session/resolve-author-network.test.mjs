import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveAuthorNetwork } from './resolve-author-network.ts'

test('author network views do not invent sessionStorage or constellation success', () => {
  const resolution = resolveAuthorNetwork()
  assert.equal(resolution.kind, 'unavailable')
  assert.equal(resolution.reason, 'missing-author-network-projector')
  assert.match(resolution.message, /请稍后再试/)
})
