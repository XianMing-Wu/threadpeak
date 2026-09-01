import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveAccountIdentity } from './resolve-account-identity.ts'

test('shell account control does not invent a signed-in profile name', () => {
  const resolution = resolveAccountIdentity()
  assert.equal(resolution.kind, 'unavailable')
  assert.equal(resolution.reason, 'missing-identity-provider')
  assert.match(resolution.title, /本地原型账号/)
  assert.match(resolution.message, /不能用写死的姓名冒充当前登录用户/)
})
