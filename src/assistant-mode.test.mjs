import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeAssistantMode } from './assistant-mode.ts'

test('persisted authors mode is not a sendable entry and normalizes to empty', () => {
  assert.equal(normalizeAssistantMode('authors'), '')
  assert.equal(normalizeAssistantMode('route'), 'route')
  assert.equal(normalizeAssistantMode('visual'), '')
  assert.equal(normalizeAssistantMode('coach'), '')
})
