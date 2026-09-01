import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveVisualAnswer } from './resolve-visual-answer.ts'

test('visual chat answers do not invent prewritten success', () => {
  const resolution = resolveVisualAnswer()
  assert.equal(resolution.kind, 'unavailable')
  assert.equal(resolution.reason, 'missing-visual-provider')
  assert.match(resolution.message, /不能用预写图或页面计时冒充成功/)
})
