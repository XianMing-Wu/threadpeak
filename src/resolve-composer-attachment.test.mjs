import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveComposerAttachment, resolveComposerSources } from './resolve-composer-attachment.ts'

test('composer attachments do not invent an uploaded PDF', () => {
  const resolution = resolveComposerAttachment()
  assert.equal(resolution.kind, 'unavailable')
  assert.equal(resolution.reason, 'missing-attachment-provider')
  assert.match(resolution.message, /不能把本地文件名当成已上传 PDF/)
})

test('composer source scope does not invent uploaded documents', () => {
  const resolution = resolveComposerSources()
  assert.equal(resolution.kind, 'unavailable')
  assert.equal(resolution.reason, 'missing-sources-provider')
  assert.match(resolution.message, /不能把知乎或已上传 PDF/)
})
