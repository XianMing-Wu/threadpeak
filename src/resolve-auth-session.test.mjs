import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveAuthSession } from './resolve-auth-session.ts'

test('auth landing does not invent a Zhihu OAuth success', () => {
  const resolution = resolveAuthSession()
  assert.equal(resolution.kind, 'unavailable')
  assert.equal(resolution.reason, 'missing-oauth-provider')
  assert.match(resolution.message, /不能把本地开关或延时动画当成知乎账号授权成功/)
})
