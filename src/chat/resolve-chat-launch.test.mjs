import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveChatLaunch } from './resolve-chat-launch.ts'

test('chat without a send context is an independent 404, not a prewritten query', () => {
  const resolution = resolveChatLaunch(null)
  assert.equal(resolution.kind, 'not-found')
})

test('a user-triggered launch payload can still open chat', () => {
  const resolution = resolveChatLaunch({
    query: '验证附件失败后仍能发送',
    mode: 'answer',
    conversationId: 'conv-1',
  })
  assert.equal(resolution.kind, 'ready')
  if (resolution.kind !== 'ready') return
  assert.equal(resolution.query, '验证附件失败后仍能发送')
  assert.equal(resolution.mode, 'answer')
  assert.equal(resolution.conversationId, 'conv-1')
})
