import assert from 'node:assert/strict'
import test from 'node:test'
import { requestGraphBootstrap, requestGraphSnapshot } from './request-graph-bootstrap.ts'

const root = {
  nodeId: 'root',
  title: '核与像',
  role: 'root',
  canonicalContentHash: 'abc',
}

test('graph bootstrap fail-closes without inventing a root', async () => {
  const result = await requestGraphBootstrap({
    routeId: 'generated-path',
    conceptId: 'kernel-image',
    title: '核与像',
    fetch: async () => {
      throw new Error('offline')
    },
  })
  assert.equal(result.kind, 'unavailable')
  assert.match(result.message, /不能用页面 growGraph 发明节点/)
})

test('completed bootstrap keeps the unique root and canonical hash', async () => {
  const result = await requestGraphBootstrap({
    routeId: 'generated-path',
    conceptId: 'kernel-image',
    title: '核与像',
    fetch: async (url) => {
      if (String(url).includes('/api/ready')) {
        return { ok: true, status: 200, text: async () => JSON.stringify({ ready: true }) }
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          kind: 'completed',
          graphId: 'kg_1',
          routeId: 'generated-path',
          conceptId: 'kernel-image',
          canonicalContentHash: 'abc',
          revision: 1,
          draftCount: 0,
          reused: false,
          root,
        }),
      }
    },
  })
  assert.equal(result.kind, 'completed')
  assert.equal(result.graph.root.nodeId, 'root')
  assert.equal(result.graph.revision, 1)
  assert.equal(result.graph.canonicalContentHash, 'abc')
  assert.equal(result.graph.draftCount, 0)
})

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
})
