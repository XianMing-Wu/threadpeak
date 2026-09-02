import assert from 'node:assert/strict'
import test from 'node:test'
import { createCanonicalAnswerStore } from './canonical-answer.ts'
import { createGraphSurgeon } from './graph-surgeon.ts'

test('bootstrap fails closed when the canonical first answer is missing', async () => {
  const canonical = createCanonicalAnswerStore()
  const surgeon = createGraphSurgeon(canonical)
  const result = await surgeon.bootstrap({
    routeId: 'route-1',
    conceptId: 'linear-map',
    title: '线性映射',
  })
  assert.equal(result.kind, 'failed')
  assert.equal(result.code, 'CANONICAL_MISSING')
  assert.equal(surgeon.get('route-1', 'linear-map'), undefined)
})

test('bootstrap after a settled canonical creates one graph with exactly one root', async () => {
  const canonical = createCanonicalAnswerStore()
  const surgeon = createGraphSurgeon(canonical)
  const settled = await canonical.ensure({
    routeId: 'route-1',
    conceptId: 'linear-map',
    title: '线性映射',
    generate: async () => ({ kind: 'completed', text: '线性映射保持加法和数乘。', evidenceCount: 3 }),
  })
  assert.equal(settled.kind, 'completed')
  const first = await surgeon.bootstrap({
    routeId: 'route-1',
    conceptId: 'linear-map',
    title: '线性映射',
  })
  const second = await surgeon.bootstrap({
    routeId: 'route-1',
    conceptId: 'linear-map',
    title: '线性映射',
  })
  assert.equal(first.kind, 'completed')
  assert.equal(second.kind, 'completed')
  assert.equal(first.reused, false)
  assert.equal(second.reused, true)
  assert.equal(first.draftCount, 0)
  assert.equal(first.graph.revision, 1)
  assert.equal(second.graph.revision, 1)
  assert.equal(first.graph.graphId, second.graph.graphId)
  assert.equal(first.graph.root.nodeId, 'root')
  assert.equal(first.graph.root.role, 'root')
  assert.equal(first.graph.canonicalContentHash, settled.answer.contentHash)
  assert.equal(first.graph.root.canonicalContentHash, settled.answer.contentHash)
  assert.equal(surgeon.get('route-1', 'linear-map')?.graphId, first.graph.graphId)
})

test('concurrent bootstrap shares one graph and does not create a second root', async () => {
  const canonical = createCanonicalAnswerStore()
  await canonical.ensure({
    routeId: 'r',
    conceptId: 'c',
    title: '概念',
    generate: async () => ({ kind: 'completed', text: '同一份首次回复。', evidenceCount: 1 }),
  })
  const surgeon = createGraphSurgeon(canonical)
  const [left, right] = await Promise.all([
    surgeon.bootstrap({ routeId: 'r', conceptId: 'c', title: '概念' }),
    surgeon.bootstrap({ routeId: 'r', conceptId: 'c', title: '概念' }),
  ])
  assert.equal(left.kind, 'completed')
  assert.equal(right.kind, 'completed')
  assert.equal(left.graph.graphId, right.graph.graphId)
  assert.equal(left.graph.root.nodeId, right.graph.root.nodeId)
  assert.equal(left.graph.revision, 1)
})

test('bootstrap never regenerates or overwrites the canonical first answer', async () => {
  let calls = 0
  const canonical = createCanonicalAnswerStore()
  await canonical.ensure({
    routeId: 'r',
    conceptId: 'c',
    title: '概念',
    generate: async () => {
      calls += 1
      return { kind: 'completed', text: '冻结的首次回复。', evidenceCount: 2 }
    },
  })
  const before = canonical.get('r', 'c')
  const surgeon = createGraphSurgeon(canonical)
  await surgeon.bootstrap({ routeId: 'r', conceptId: 'c', title: '概念' })
  await surgeon.bootstrap({ routeId: 'r', conceptId: 'c', title: '概念' })
  const after = canonical.get('r', 'c')
  assert.equal(calls, 1)
  assert.equal(before?.text, '冻结的首次回复。')
  assert.equal(after?.text, before?.text)
  assert.equal(after?.contentHash, before?.contentHash)
})

test('zero A1 drafts still leave a structural root and invent no extra nodes', async () => {
  const canonical = createCanonicalAnswerStore()
  const settled = await canonical.ensure({
    routeId: 'r',
    conceptId: 'c',
    title: '概念',
    generate: async () => ({ kind: 'completed', text: '只有根节点。', evidenceCount: 1 }),
  })
  const surgeon = createGraphSurgeon(canonical)
  const result = await surgeon.bootstrap({ routeId: 'r', conceptId: 'c', title: '概念' })
  assert.equal(result.kind, 'completed')
  assert.equal(result.draftCount, 0)
  assert.equal(result.graph.root.nodeId, 'root')
  assert.notEqual(result.graph.root.title, settled.answer.text)
  assert.doesNotMatch(result.graph.root.title, /只有根节点/)
})
