import assert from 'node:assert/strict'
import test from 'node:test'
import { annotationScopeId, annotationsInScope, applyAskAuthorResult, findQuoteSpan, isLiuKanshanDirect, isPersistedAnnotation, liuKanshanDirectReply, nextOrdinal } from './ask-authors.ts'

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
  assert.equal(isPersistedAnnotation({
    id: 'ann-4',
    scopeId: 'linear-algebra::linear-map',
    ordinal: 1,
    nodeId: 'root',
    quote: '线性变换',
    question: '什么意思',
    status: 'ready',
    reply: liuKanshanDirectReply('零可信作者时的直达正文。'),
  }), true)
})

test('zero trusted authors become 刘看山直达 and are not live blogger replies', () => {
  const answering = {
    id: 'ann-5',
    scopeId: 'generated-path::core',
    ordinal: 1,
    nodeId: 'root',
    quote: '微积分研究变化率',
    question: '什么意思',
    status: 'answering',
    reply: null,
  }
  const direct = applyAskAuthorResult(answering, { kind: 'direct', text: '变化率就是导数。' })
  assert.equal(direct.status, 'ready')
  assert.equal(direct.reply?.source, 'liu-kanshan-direct')
  assert.equal(isLiuKanshanDirect(direct.reply), true)
  assert.match(direct.reply?.text ?? '', /变化率就是导数/)
  assert.equal(isPersistedAnnotation(direct), true)

  const live = applyAskAuthorResult(answering, {
    kind: 'authors',
    authors: [{
      name: '真实作者',
      bio: '公开内容',
      title: '线性映射',
      url: 'https://www.zhihu.com/question/1',
      text: '摘要',
      source: 'zhihu-live',
    }],
  })
  assert.equal(live.status, 'ready')
  assert.equal(live.reply?.source, 'zhihu-live')
  assert.equal(isLiuKanshanDirect(live.reply), false)
  assert.equal(isPersistedAnnotation(live), true)

  const failed = applyAskAuthorResult(answering, { kind: 'unavailable', message: '知乎检索不可用，不能完成本次问博主。' })
  assert.equal(failed.status, 'unavailable')
  assert.equal(failed.reply, null)
  assert.match(failed.error ?? '', /知乎检索不可用/)
})

test('annotation ordinals start at 1 and quotes match markdown source or rendered text', () => {
  assert.equal(nextOrdinal([], 'route::concept'), 1)
  assert.equal(nextOrdinal([
    { id: 'ann-1', scopeId: 'route::concept', ordinal: 1, nodeId: 'root', quote: '局部线性化', question: '为什么', status: 'ready', reply: liuKanshanDirectReply('直达') },
  ], 'route::concept'), 2)
  assert.equal(nextOrdinal([
    { id: 'ann-1', scopeId: 'route::concept', ordinal: 1, nodeId: 'root', quote: '局部线性化', question: '为什么', status: 'ready', reply: liuKanshanDirectReply('直达') },
  ], 'other::concept'), 1)

  assert.deepEqual(findQuoteSpan('导数可以理解为函数在某点的局部线性化。', '局部线性化'), { start: 13, end: 18 })
  assert.deepEqual(findQuoteSpan('导数可以理解为函数在某点的**局部线性化**。', '局部线性化'), { start: 15, end: 20 })
  const wrapped = findQuoteSpan('导数可以理解为\n函数在某点的局部线性化。', '局部 线性化')
  assert.ok(wrapped)
  assert.equal('导数可以理解为\n函数在某点的局部线性化。'.slice(wrapped.start, wrapped.end).replace(/\s+/g, ''), '局部线性化')
  assert.equal(findQuoteSpan('没有这句话', '局部线性化'), null)
})

test('new conversations use a separate annotation scope so 新对话 does not inherit 批注', () => {
  assert.equal(annotationScopeId('route', 'concept'), 'route::concept')
  assert.equal(annotationScopeId('route', 'concept', 'learn-1'), 'route::concept::learn-1')
  assert.notEqual(annotationScopeId('route', 'concept', 'learn-1'), annotationScopeId('route', 'concept', 'learn-2'))
})

test('the concept canvas sees annotations from every conversation on that concept', () => {
  const items = [
    { id: 'a', scopeId: 'route::concept::learn-1', ordinal: 1, nodeId: 'root', quote: '甲', question: 'q', status: 'ready', reply: liuKanshanDirectReply('1') },
    { id: 'b', scopeId: 'route::concept::learn-2', ordinal: 1, nodeId: 'root', quote: '乙', question: 'q', status: 'ready', reply: liuKanshanDirectReply('2') },
  ]
  assert.equal(annotationsInScope(items, 'route::concept').length, 2)
  assert.equal(annotationsInScope(items, 'route::concept::learn-1').length, 1)
  assert.equal(annotationsInScope(items, 'route::concept::learn-2')[0]?.id, 'b')
})
