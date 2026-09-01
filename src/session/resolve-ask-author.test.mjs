import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveAskAuthor } from './resolve-ask-author.ts'

test('ask-author requests do not invent fixed-author success', () => {
  const resolution = resolveAskAuthor()
  assert.equal(resolution.kind, 'unavailable')
  assert.equal(resolution.reason, 'missing-ask-author-provider')
  assert.match(resolution.message, /不能用固定作者或预写回答冒充成功/)
})
