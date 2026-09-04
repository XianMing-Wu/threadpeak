import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveSettingsIdentity, resolveSettingsSources } from './resolve-settings-identity.ts'

test('settings identity does not invent a signed-in profile', () => {
  const resolution = resolveSettingsIdentity()
  assert.equal(resolution.kind, 'unavailable')
  assert.equal(resolution.reason, 'missing-identity-provider')
  assert.match(resolution.message, /请稍后再试/)
})

test('settings sources do not invent an uploaded-PDF scope', () => {
  const resolution = resolveSettingsSources()
  assert.equal(resolution.kind, 'unavailable')
  assert.equal(resolution.reason, 'missing-sources-provider')
  assert.match(resolution.message, /请重新选择/)
})
