import assert from 'node:assert/strict'
import test from 'node:test'
import { projectBootstrappedGraph } from './project-bootstrapped-graph.ts'

const graph = {
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
}

test('bootstrapped projection joins the matching first answer onto the unique root', () => {
  const view = projectBootstrappedGraph(graph, {
    text: '微积分与线性代数是机器学习的基础。\n\n根节点只引用这份已 settle 的首次回复。',
    contentHash: 'abc',
  })
  assert.equal(view.kind, 'ready')
  if (view.kind !== 'ready') return
  assert.equal(view.nodes.length, 1)
  assert.equal(view.edges.length, 0)
  assert.equal(view.nodes[0]?.id, 'root')
  assert.equal(view.nodes[0]?.title, '核与像')
  const body = view.nodes[0]?.turns[0]?.paragraphs.join('\n') ?? ''
  assert.match(body, /微积分与线性代数是机器学习的基础/)
  assert.doesNotMatch(body, /结构锚点/)
  assert.doesNotMatch(body, /content hash/)
  assert.doesNotMatch(body, /线性映射保持加法/)
})

test('bootstrapped projection fail-closes when the first-answer hash does not match', () => {
  const view = projectBootstrappedGraph(graph, {
    text: '另一份正文不能顶替首次回复。',
    contentHash: 'other',
  })
  assert.equal(view.kind, 'unavailable')
  if (view.kind !== 'unavailable') return
  assert.match(view.message, /同一份首次回复/)
})
