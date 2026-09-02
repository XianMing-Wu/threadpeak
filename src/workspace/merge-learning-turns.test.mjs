import assert from 'node:assert/strict'
import test from 'node:test'
import { isUsableAssistantTurn, mergeSuccessfulLearningTurn } from './merge-learning-turns.ts'

test('a later successful reply replaces the failed assistant for the same question', () => {
  const merged = mergeSuccessfulLearningTurn([
    { role: 'user', text: '引用「缩放比例」\n如何理解？' },
    { role: 'assistant', text: '模型服务不可用，不能生成这次回答。', failed: true },
  ], {
    userText: '引用「缩放比例」\n如何理解？',
    reply: '特征值是沿特征向量方向的拉伸倍数。',
    extras: { quote: '缩放比例', grow: 'succ', growSource: 'model' },
  })
  assert.equal(merged.length, 2)
  assert.equal(merged[0]?.grow, 'succ')
  assert.equal(merged[1]?.role, 'assistant')
  assert.equal(merged[1]?.failed, undefined)
  assert.match(merged[1]?.text ?? '', /拉伸倍数/)
  assert.equal(isUsableAssistantTurn(merged[1]), true)
})

test('a dangling draft user turn is not duplicated after success', () => {
  const merged = mergeSuccessfulLearningTurn([
    { role: 'user', text: '缩放比例如何理解？' },
  ], {
    userText: '缩放比例如何理解？',
    reply: '沿特征向量方向的倍数。',
    extras: { grow: 'succ', growSource: 'heuristic' },
  })
  assert.deepEqual(merged.map((item) => item.role), ['user', 'assistant'])
})
