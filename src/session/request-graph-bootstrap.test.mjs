import assert from 'node:assert/strict'
import test from 'node:test'
import { requestGraphSnapshot } from './request-graph-bootstrap.ts'

const root = {
  nodeId: 'root',
  title: '核与像',
  role: 'root',
  canonicalContentHash: 'abc',
}

test('canvas snapshot is read-only and fail-closes when the graph is missing', async () => {
  const missing = await requestGraphSnapshot({
    routeId: 'generated-path',
    conceptId: 'kernel-image',
    fetch: async () => ({
      ok: false,
      status: 404,
      text: async () => JSON.stringify({ kind: 'missing' }),
    }),
  })
  assert.equal(missing.kind, 'unavailable')
  assert.match(missing.message, /不能用页面 growGraph 发明节点/)
  const present = await requestGraphSnapshot({
    routeId: 'generated-path',
    conceptId: 'kernel-image',
    fetch: async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        kind: 'completed',
        graphId: 'kg_1',
        routeId: 'generated-path',
        conceptId: 'kernel-image',
        canonicalContentHash: 'abc',
        revision: 1,
        root,
      }),
    }),
  })
  assert.equal(present.kind, 'completed')
  assert.equal(present.graph.reused, true)
  assert.equal(present.graph.root.nodeId, 'root')
})
