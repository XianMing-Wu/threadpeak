import assert from 'node:assert/strict'
import test from 'node:test'
import { isPersistedAnnotation } from './ask-authors.ts'

test('old fixture author replies are not treated as live annotations', () => {
  assert.equal(isPersistedAnnotation({
    id: 'ann-1',
    scopeId: 'linear-algebra::linear-map',
    ordinal: 1,
    nodeId: 'root',
    quote: '线性变换',
    question: '为什么？',
    status: 'ready',
    reply: {
      name: '马同学',
      bio: '讲解线性代数',
      title: '线性映射',
      url: 'https://www.zhihu.com/people/x',
      text: '旧假成功',
    },
  }), false)
  assert.equal(isPersistedAnnotation({
    id: 'ann-2',
    scopeId: 'linear-algebra::linear-map',
    ordinal: 1,
    nodeId: 'root',
    quote: '线性变换',
    question: '为什么？',
    status: 'unavailable',
    reply: null,
    error: 'missing',
  }), false)
  assert.equal(isPersistedAnnotation({
    id: 'ann-3',
    scopeId: 'linear-algebra::linear-map',
    ordinal: 1,
    nodeId: 'root',
    quote: '线性变换',
    question: '为什么？',
    status: 'ready',
    reply: {
      name: '真实作者',
      bio: '公开内容',
      title: '线性映射',
      url: 'https://www.zhihu.com/question/1',
      text: '摘要',
      source: 'zhihu-live',
    },
  }), true)
})
