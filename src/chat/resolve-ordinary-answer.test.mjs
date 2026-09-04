import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveOrdinaryAnswer } from './resolve-ordinary-answer.ts'

test('ordinary chat answers do not invent prewritten success', () => {
  const resolution = resolveOrdinaryAnswer()
  assert.equal(resolution.kind, 'unavailable')
  assert.equal(resolution.reason, 'missing-answer-provider')
  assert.match(resolution.message, /请稍后再试/)
})
