import assert from 'node:assert/strict'
import test from 'node:test'
import { isExampleFixtureDocumentId, resolvePath3DView } from './resolved-path-document.ts'

const generatedDocument = {
  protocol: 'learning-path',
  version: '1.0',
  id: 'generated-path',
  metadata: { title: '从目标到可验证作品', locale: 'zh-CN' },
  structure: {
    entrySubjectId: 'subject-start',
    goalSubjectIds: ['subject-goal'],
    subjects: [{ id: 'subject-start', cardRef: 'card-start' }],
    concepts: [],
    flow: [],
    flowGroups: [],
  },
}

test('missing route id does not fall back to the linear-algebra fixture', () => {
  const view = resolvePath3DView({ routeId: '' })
  assert.equal(view.kind, 'unavailable')
  assert.equal(view.reason, 'missing-route')
  assert.match(view.message, /不能把内置演示路径当作用户结果/)
})

test('mine routes require a validated document and never use the example fixture id', () => {
  const missing = resolvePath3DView({
    routeId: 'mine-1',
    route: { id: 'mine-1', owner: 'mine', title: '我的路线', document: { protocol: 'other', version: '1.0', id: 'x' } },
  })
  assert.equal(missing.kind, 'unavailable')
  assert.equal(missing.reason, 'invalid-mine-document')

  const fixture = resolvePath3DView({
    routeId: 'mine-2',
    route: {
      id: 'mine-2',
      owner: 'mine',
      title: '伪造成功',
      document: { ...generatedDocument, id: 'threadpeak-linear-algebra-v1' },
    },
  })
  assert.equal(fixture.kind, 'unavailable')
  assert.equal(fixture.reason, 'invalid-mine-document')
  assert.equal(isExampleFixtureDocumentId('threadpeak-linear-algebra-v1'), true)
})

test('validated mine documents and marked example documents can render', () => {
  const mine = resolvePath3DView({
    routeId: 'generated-path',
    route: { id: 'generated-path', owner: 'mine', title: '从目标到可验证作品', document: generatedDocument },
  })
  assert.deepEqual(mine, {
    kind: 'ready',
    source: 'mine',
    routeId: 'generated-path',
    title: '从目标到可验证作品',
    document: generatedDocument,
  })

  const example = resolvePath3DView({
    routeId: 'linear-algebra',
    route: {
      id: 'linear-algebra',
      owner: 'example',
      title: '从线性代数走向机器学习',
      document: { ...generatedDocument, id: 'threadpeak-linear-algebra-v1' },
    },
  })
  assert.equal(example.kind, 'ready')
  assert.equal(example.source, 'example')
})
