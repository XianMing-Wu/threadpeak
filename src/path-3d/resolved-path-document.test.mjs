import assert from 'node:assert/strict'
import test from 'node:test'
import { isExampleFixtureDocumentId, isRenderableMineRoute, resolvePath3DView } from './resolved-path-document.ts'
import { validRendererDocumentFixture, validateRendererDocument } from './validate-renderer-document.ts'

const generatedDocument = validRendererDocumentFixture('generated-path')

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

test('incomplete flowGroup documents are not treated as validated', () => {
  const invalid = {
    ...generatedDocument,
    structure: {
      ...generatedDocument.structure,
      flowGroups: [{ id: 'group-1' }],
    },
  }
  assert.equal(validateRendererDocument(invalid).ok, false)
  const view = resolvePath3DView({
    routeId: 'generated-path',
    route: { id: 'generated-path', owner: 'mine', title: '从目标到可验证作品', document: invalid },
  })
  assert.equal(view.kind, 'unavailable')
})

test('incomplete live-route stubs are not listed as enterable mine routes', () => {
  assert.equal(isRenderableMineRoute({
    owner: 'mine',
    document: {
      protocol: 'learning-path',
      version: '1.0',
      id: 'live-route',
      metadata: { title: '核与像', locale: 'zh-CN' },
      structure: { subjects: [], concepts: [{ id: 'live-concept' }], flowGroups: [] },
      data: { cards: [{ id: 'card-1' }] },
    },
  }), false)
  assert.equal(isRenderableMineRoute({
    owner: 'mine',
    document: generatedDocument,
  }), true)
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
