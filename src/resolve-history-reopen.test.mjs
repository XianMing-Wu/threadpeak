import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveHistoryReopen } from './resolve-history-reopen.ts'

test('history reopen does not invent localStorage conversation success', () => {
  const resolution = resolveHistoryReopen()
  assert.equal(resolution.kind, 'unavailable')
  assert.equal(resolution.reason, 'missing-history-provider')
  assert.match(resolution.message, /不能用 localStorage 正文冒充精确重开/)
})
