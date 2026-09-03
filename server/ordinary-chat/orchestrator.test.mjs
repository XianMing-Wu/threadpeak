import assert from 'node:assert/strict'
import test from 'node:test'
import { createOrdinaryChatOrchestrator } from './orchestrator.ts'

test('empty current message fails closed without calling R5', async () => {
  const calls = []
  const api = createOrdinaryChatOrchestrator({
    async invokeText(agentId, context) {
      calls.push({ agentId, context })
      return { kind: 'completed', agentId: 'R5', text: '不应出现', compressed: false }
    },
  })
  const result = await api.reply({ currentMessage: '   ' })
  assert.equal(result.kind, 'failed')
  assert.equal(result.code, 'PROVIDER_INVALID')
  assert.equal(calls.length, 0)
})

test('R5 receives the full conversation and chat-bound attachments', async () => {
  const calls = []
  const api = createOrdinaryChatOrchestrator({
    async invokeText(agentId, context, options) {
      calls.push({ agentId, context, options })
      return { kind: 'completed', agentId: 'R5', text: '线性映射保持加法和数乘。', compressed: true }
    },
  })
  const result = await api.reply({
    currentMessage: '再举一个例子',
    conversation: [
      { messageId: 'm-0', role: 'user', kind: 'text', content: '什么是线性映射？' },
      { messageId: 'm-1', role: 'assistant', kind: 'text', content: '它同时保持加法和数乘。' },
      { messageId: 'drop', role: 'user', kind: 'text' },
    ],
    attachments: [
      { sourceId: 'att-1', fileName: 'note.txt', content: '讲义：保运算' },
      { sourceId: 'bad', fileName: 'x.txt' },
    ],
  })
  assert.equal(result.kind, 'completed')
  assert.equal(result.text, '线性映射保持加法和数乘。')
  assert.equal(result.compressed, true)
  assert.equal(calls[0].agentId, 'R5')
  assert.equal(calls[0].options.thinkingDepth, 'fast')
  assert.deepEqual(calls[0].context.currentMessage, '再举一个例子')
  assert.equal(calls[0].context.conversation.length, 2)
  assert.equal(calls[0].context.conversation[0].messageId, 'm-0')
  assert.equal(calls[0].context.attachments.length, 1)
  assert.equal(calls[0].context.attachments[0].sourceId, 'att-1')
})

test('R5 provider failure is explicit and does not invent a reply', async () => {
  const api = createOrdinaryChatOrchestrator({
    async invokeText() {
      return { kind: 'failed', agentId: 'R5', code: 'PROVIDER_UNAVAILABLE', message: '模型服务不可用。' }
    },
  })
  const result = await api.reply({ currentMessage: '什么是线性映射？' })
  assert.equal(result.kind, 'failed')
  assert.equal(result.code, 'PROVIDER_UNAVAILABLE')
  assert.match(result.message, /模型服务不可用/)
})
