import assert from 'node:assert/strict'
import test from 'node:test'
import { isInternalLayerId, readableLayerTitle, titleFromPathLayer } from './layer-title.ts'
import { resolveNetworkCarrierTitle, resolveNetworkLayerTitle } from './resolve-layer-title.ts'

test('internal subject ids are not readable layer titles', () => {
  assert.equal(isInternalLayerId('s-carrier-uuid-1'), true)
  assert.equal(readableLayerTitle('s-carrier-uuid-1'), '')
  assert.equal(readableLayerTitle('强化学习基础'), '强化学习基础')
  assert.equal(readableLayerTitle('Softmax'), 'Softmax')
})

test('path documents resolve carrier ids through the subject card title', () => {
  const document = {
    structure: {
      subjects: [{ id: 's-carrier-uuid-1', cardRef: 'cs-carrier-1' }],
      concepts: [{ id: 'c-concept-uuid-1', cardRef: 'cc-1', subjectId: 's-carrier-uuid-1' }],
    },
    data: {
      cards: [
        { id: 'cs-carrier-1', title: '强化学习基础', summary: '先建立状态与动作。' },
        { id: 'cc-1', title: '马尔可夫决策过程' },
      ],
    },
  }
  assert.equal(titleFromPathLayer(document, 's-carrier-uuid-1'), '强化学习基础')
  assert.equal(titleFromPathLayer(document, 'c-concept-uuid-1'), '马尔可夫决策过程')
  assert.equal(resolveNetworkLayerTitle('s-carrier-uuid-1', [{ document }]), '强化学习基础')
  assert.equal(resolveNetworkLayerTitle('强化学习基础', [{ document }]), '强化学习基础')
  assert.equal(resolveNetworkLayerTitle('s-carrier-uuid-1', []), '')
  assert.equal(resolveNetworkCarrierTitle({
    carrierTitle: 's-carrier-uuid-1',
    carrierId: 's-carrier-uuid-1',
    conceptId: 'c-concept-uuid-1',
    conceptTitle: '马尔可夫决策过程',
  }, [{ document }]), '强化学习基础')
  assert.equal(resolveNetworkCarrierTitle({
    conceptId: 'c-concept-uuid-1',
    conceptTitle: '马尔可夫决策过程',
  }, [{ document }]), '强化学习基础')
})
