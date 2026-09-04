import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveHistoryReopen } from './resolve-history-reopen.ts'

test('history reopen does not invent a committed conversation when the draft is gone', () => {
  const missing = resolveHistoryReopen()
  assert.equal(missing.kind, 'unavailable')
  assert.match(missing.message, /没有可以重新打开的对话/)

  const learningGone = resolveHistoryReopen({
    id: 'learn-1',
    title: '线性映射 · 对话 1',
    query: 'linear-map',
    experience: 'learning',
  })
  assert.equal(learningGone.kind, 'unavailable')
  assert.match(learningGone.message, /学习记录已经不在了/)
})

test('a learning history entry with route and concept reopens the local draft scope', () => {
  const resolution = resolveHistoryReopen({
    id: 'learn-stale',
    title: '线性映射 · 对话 1',
    query: 'linear-map',
    experience: 'learning',
    routeId: 'linear-algebra',
    conceptId: 'linear-map',
  })
  assert.equal(resolution.kind, 'draft-learning')
  if (resolution.kind !== 'draft-learning') return
  assert.equal(resolution.routeId, 'linear-algebra')
  assert.equal(resolution.conceptId, 'linear-map')
})

test('a local learning draft reopens the same route and concept', () => {
  const resolution = resolveHistoryReopen({
    id: 'learn-1',
    title: '线性映射 · 对话 1',
    query: 'linear-map',
    experience: 'learning',
    routeId: 'linear-algebra',
    conceptId: 'linear-map',
  }, {
    id: 'learn-1',
    kind: 'learning',
    query: 'linear-map',
    routeId: 'linear-algebra',
    conceptId: 'linear-map',
  })
  assert.deepEqual(resolution, {
    kind: 'draft-learning',
    conversationId: 'learn-1',
    routeId: 'linear-algebra',
    conceptId: 'linear-map',
  })
})

test('a local chat draft reopens query context without claiming a committed GET', () => {
  const resolution = resolveHistoryReopen({
    id: 'chat-1',
    title: '什么是线性映射',
    query: '什么是线性映射',
    experience: 'answer',
  }, {
    id: 'chat-1',
    kind: 'home-answer',
    query: '什么是线性映射',
    experience: 'answer',
  })
  assert.equal(resolution.kind, 'draft-chat')
  if (resolution.kind !== 'draft-chat') return
  assert.equal(resolution.query, '什么是线性映射')
  assert.equal(resolution.experience, 'answer')
})
