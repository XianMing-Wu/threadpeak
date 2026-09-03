import assert from 'node:assert/strict'
import test from 'node:test'
import { buildOrdinaryChatContext } from './build-ordinary-chat-context.ts'

test('pending current message is not duplicated into conversation', () => {
  const context = buildOrdinaryChatContext({
    currentMessage: '再举一个例子',
    turns: [
      { role: 'user', text: '什么是线性映射？' },
      { role: 'assistant', text: '它同时保持加法和数乘。' },
      { role: 'user', text: '再举一个例子' },
    ],
    attachments: [{ sourceId: 'att-1', fileName: 'note.txt', content: '讲义' }],
  })
  assert.equal(context.currentMessage, '再举一个例子')
  assert.equal(context.conversation.length, 2)
  assert.equal(context.conversation[0].messageId, 'm-0')
  assert.equal(context.conversation[1].role, 'assistant')
  assert.equal(context.attachments[0].sourceId, 'att-1')
})

test('first send uses empty prior conversation', () => {
  const context = buildOrdinaryChatContext({
    currentMessage: '什么是线性映射？',
    turns: [],
  })
  assert.equal(context.conversation.length, 0)
  assert.equal(context.attachments.length, 0)
})
