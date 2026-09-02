import assert from 'node:assert/strict'
import test from 'node:test'
import { createCanonicalAnswerStore, seedQuestion } from './canonical-answer.ts'

test('canonical answers are generated once and reused forever', async () => {
  let calls = 0
  const store = createCanonicalAnswerStore()
  const generate = async () => {
    calls += 1
    return { kind: 'completed', text: '线性映射保持加法和数乘。', evidenceCount: 3 }
  }
  const first = await store.ensure({
    routeId: 'route-1',
    conceptId: 'linear-map',
    title: '线性映射',
    generate,
  })
  const second = await store.ensure({
    routeId: 'route-1',
    conceptId: 'linear-map',
    title: '线性映射',
    generate,
  })
  assert.equal(first.kind, 'completed')
  assert.equal(second.kind, 'completed')
  assert.equal(first.reused, false)
  assert.equal(second.reused, true)
  assert.equal(first.answer.text, second.answer.text)
  assert.equal(first.answer.contentHash, second.answer.contentHash)
  assert.equal(calls, 1)
  assert.equal(store.get('route-1', 'linear-map')?.text, '线性映射保持加法和数乘。')
})

test('concurrent first entries share one generation and do not create two canonicals', async () => {
  let calls = 0
  let release
  const gate = new Promise((resolve) => { release = resolve })
  const store = createCanonicalAnswerStore()
  const generate = async () => {
    calls += 1
    await gate
    return { kind: 'completed', text: '同一份首次回复。', evidenceCount: 1 }
  }
  const a = store.ensure({ routeId: 'r', conceptId: 'c', title: '概念', generate })
  const b = store.ensure({ routeId: 'r', conceptId: 'c', title: '概念', generate })
  release()
  const [left, right] = await Promise.all([a, b])
  assert.equal(calls, 1)
  assert.equal(left.kind, 'completed')
  assert.equal(right.kind, 'completed')
  assert.equal(left.answer.contentHash, right.answer.contentHash)
})

test('failed generation does not become the canonical first answer', async () => {
  const store = createCanonicalAnswerStore()
  const failed = await store.ensure({
    routeId: 'r',
    conceptId: 'c',
    title: '概念',
    generate: async () => ({ kind: 'failed', message: '模型服务不可用，不能生成这次回答。' }),
  })
  assert.equal(failed.kind, 'failed')
  assert.equal(store.get('r', 'c'), undefined)
  const later = await store.ensure({
    routeId: 'r',
    conceptId: 'c',
    title: '概念',
    generate: async () => ({ kind: 'completed', text: '补上的首次回复。', evidenceCount: 2 }),
  })
  assert.equal(later.kind, 'completed')
  assert.equal(later.reused, false)
  assert.equal(later.answer.text, '补上的首次回复。')
})

test('canonical seed is ordinary explanation and not visual or ask-author', () => {
  assert.match(seedQuestion('线性映射'), /普通概念讲解/)
  assert.match(seedQuestion('线性映射'), /不要改写成图文模式或问博主/)
})
