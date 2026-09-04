import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveAccountIdentity } from './resolve-account-identity.ts'

test('shell account control does not invent a signed-in profile name', () => {
  const resolution = resolveAccountIdentity()
  assert.equal(resolution.kind, 'unavailable')
  assert.equal(resolution.reason, 'missing-identity-provider')
  assert.match(resolution.title, /问山账号/)
  assert.match(resolution.message, /打开账号菜单/)
})
