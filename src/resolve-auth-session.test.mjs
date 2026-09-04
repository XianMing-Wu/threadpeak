import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveAuthSession } from './resolve-auth-session.ts'

test('auth landing does not invent a Zhihu OAuth success', () => {
  const resolution = resolveAuthSession()
  assert.equal(resolution.kind, 'unavailable')
  assert.equal(resolution.reason, 'missing-oauth-provider')
  assert.match(resolution.message, /请稍后再试/)
})
