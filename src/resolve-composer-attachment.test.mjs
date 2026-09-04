import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveComposerAttachment, resolveComposerSources } from './resolve-composer-attachment.ts'

test('composer attachments do not invent an uploaded PDF', () => {
  const resolution = resolveComposerAttachment()
  assert.equal(resolution.kind, 'unavailable')
  assert.equal(resolution.reason, 'missing-attachment-provider')
  assert.match(resolution.message, /请重新添加/)
})

test('composer source scope does not invent uploaded documents', () => {
  const resolution = resolveComposerSources()
  assert.equal(resolution.kind, 'unavailable')
  assert.equal(resolution.reason, 'missing-sources-provider')
  assert.match(resolution.message, /请重新选择/)
})
