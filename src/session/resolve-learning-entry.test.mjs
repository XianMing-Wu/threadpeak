import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveLearningEntry } from './resolve-learning-entry.ts'

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

test('an explicitly selected route and concept can enter', () => {
  const entry = resolveLearningEntry({
    routeId: 'linear-algebra',
    conceptId: 'linear-map',
    route: { id: 'linear-algebra' },
  })
  assert.deepEqual(entry, { kind: 'ready', routeId: 'linear-algebra', conceptId: 'linear-map' })
})
