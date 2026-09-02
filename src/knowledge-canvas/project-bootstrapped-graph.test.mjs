import assert from 'node:assert/strict'
import test from 'node:test'
import { projectBootstrappedGraph } from './project-bootstrapped-graph.ts'

test('bootstrapped projection is exactly one structural root and invents no edges', () => {
  const view = projectBootstrappedGraph({
    graphId: 'kg_1',
    routeId: 'generated-path',
    conceptId: 'kernel-image',
    canonicalContentHash: 'abc',
    revision: 1,
    draftCount: 0,
    reused: true,
    root: {
      nodeId: 'root',
      title: '核与像',
      role: 'root',
      canonicalContentHash: 'abc',
    },
  })
  assert.equal(view.nodes.length, 1)
  assert.equal(view.edges.length, 0)
  assert.equal(view.nodes[0]?.id, 'root')
  assert.equal(view.nodes[0]?.title, '核与像')
  assert.doesNotMatch(view.nodes[0]?.turns[0]?.paragraphs.join('') ?? '', /线性映射保持加法/)
  assert.match(view.nodes[0]?.turns[0]?.paragraphs.join('') ?? '', /结构锚点/)
})
