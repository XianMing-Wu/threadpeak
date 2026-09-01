import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveFirstLesson, resolveGraphMutation, resolveKnowledgeMigration, resolveLearningEntry, resolveOpenLearningTarget } from './resolve-learning-entry.ts'

test('missing route or concept does not fall back to linear-algebra', () => {
  const missingRoute = resolveLearningEntry({ routeId: '', conceptId: 'linear-map' })
  assert.equal(missingRoute.kind, 'unavailable')
  assert.equal(missingRoute.reason, 'missing-route')
  assert.match(missingRoute.message, /不能默认打开线性代数示例/)

  const unknownRoute = resolveLearningEntry({ routeId: 'linear-algebra', conceptId: 'linear-map' })
  assert.equal(unknownRoute.kind, 'unavailable')
  assert.equal(unknownRoute.reason, 'missing-route')

  const missingConcept = resolveLearningEntry({
    routeId: 'generated-path',
    conceptId: '',
    route: { id: 'generated-path' },
  })
  assert.equal(missingConcept.kind, 'unavailable')
  assert.equal(missingConcept.reason, 'missing-concept')
  assert.match(missingConcept.message, /不能默认打开“线性变换”/)
})

test('openLearning does not invent the first blueprint concept', () => {
  assert.deepEqual(resolveOpenLearningTarget('linear-algebra'), { routeId: 'linear-algebra', conceptId: '' })
  assert.deepEqual(resolveOpenLearningTarget('linear-algebra', '  '), { routeId: 'linear-algebra', conceptId: '' })
  assert.deepEqual(resolveOpenLearningTarget('generated-path', 'kernel-image'), {
    routeId: 'generated-path',
    conceptId: 'kernel-image',
  })
})

test('a selected mine route does not invent a first lesson or knowledge graph', () => {
  const mine = resolveFirstLesson({
    routeId: 'generated-path',
    conceptId: 'kernel-image',
    route: { id: 'generated-path', owner: 'mine' },
  })
  assert.equal(mine.kind, 'unavailable')
  assert.equal(mine.reason, 'missing-canonical-answer')
  assert.match(mine.message, /不能用草稿发明一课/)
  assert.match(mine.message, /不能在首次回复之前创建知识脉络/)
})

test('an example concept without a marked catalog lesson does not draft one', () => {
  const missing = resolveFirstLesson({
    routeId: 'linear-algebra',
    conceptId: 'unknown-concept',
    route: { id: 'linear-algebra', owner: 'example' },
  })
  assert.equal(missing.kind, 'unavailable')
  assert.equal(missing.reason, 'missing-example-lesson')
})

test('an example concept with a marked catalog lesson can still prepare', () => {
  const example = resolveFirstLesson({
    routeId: 'linear-algebra',
    conceptId: 'linear-map',
    route: { id: 'linear-algebra', owner: 'example' },
    catalogLesson: {
      heading: '线性变换',
      paragraphs: ['示例讲解'],
      placeholder: '围绕“线性变换”继续提问',
    },
  })
  assert.deepEqual(example, {
    kind: 'ready',
    source: 'example-catalog',
    routeId: 'linear-algebra',
    conceptId: 'linear-map',
  })
})

test('workspace read does not rewrite mine-route lessons or graphs', () => {
  assert.deepEqual(resolveKnowledgeMigration({ owner: 'mine', routeId: 'generated-path' }), {
    kind: 'keep',
    reason: 'mine-route',
  })
  assert.deepEqual(resolveKnowledgeMigration({
    owner: 'mine',
    routeId: 'generated-path',
    hasExampleBlueprint: true,
  }), { kind: 'keep', reason: 'mine-route' })
  assert.deepEqual(resolveKnowledgeMigration({
    owner: 'example',
    routeId: 'linear-algebra',
    hasExampleBlueprint: true,
  }), { kind: 'rewrite-example' })
})

test('mine routes cannot invent conversation graph nodes', () => {
  assert.deepEqual(resolveGraphMutation({ routeId: 'generated-path', owner: 'mine' }), {
    kind: 'reject',
    reason: 'missing-canonical-answer',
  })
  assert.deepEqual(resolveGraphMutation({ routeId: 'linear-algebra', owner: 'example' }), {
    kind: 'allow-example',
  })
})

test('an explicitly selected route and concept can enter', () => {
  const entry = resolveLearningEntry({
    routeId: 'linear-algebra',
    conceptId: 'linear-map',
    route: { id: 'linear-algebra' },
  })
  assert.deepEqual(entry, { kind: 'ready', routeId: 'linear-algebra', conceptId: 'linear-map' })
})
