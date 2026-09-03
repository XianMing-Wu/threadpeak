import assert from 'node:assert/strict'
import test from 'node:test'
import { projectAuthorNetworkGraph } from './project-author-network.ts'

test('high-weight records project carrier → concept → question → author', () => {
  const graph = projectAuthorNetworkGraph([{
    authorId: 'author-a',
    name: '作者甲',
    weight: 'high',
    carrierTitle: '数学基础',
    conceptTitle: '线性映射',
    question: '线性映射为什么保持加法？',
  }])
  assert.deepEqual(graph.nodes.map((item) => item.kind), ['author', 'carrier', 'concept', 'question'])
  assert.equal(graph.edges.some((item) => item.kind === 'has-concept'), true)
  assert.equal(graph.edges.some((item) => item.kind === 'has-question'), true)
  assert.equal(graph.edges.some((item) => item.kind === 'authored-at' && item.source.startsWith('author:')), true)
})

test('low-weight records keep question → author and do not invent a carrier', () => {
  const graph = projectAuthorNetworkGraph([{
    authorId: 'author-b',
    name: '作者乙',
    weight: 'low',
    question: '谁在讲 softmax？',
  }])
  assert.equal(graph.nodes.some((item) => item.kind === 'carrier' || item.kind === 'concept'), false)
  assert.equal(graph.nodes.some((item) => item.kind === 'question' && item.label === '谁在讲 softmax？'), true)
  assert.equal(graph.edges.length, 1)
  assert.equal(graph.edges[0].kind, 'authored-at')
})

test('internal carrier ids resolve to the subject card title when the route document is present', () => {
  const graph = projectAuthorNetworkGraph([{
    authorId: 'author-a',
    name: '作者甲',
    weight: 'high',
    carrierId: 's-carrier-uuid-1',
    carrierTitle: 's-carrier-uuid-1',
    conceptId: 'n-concept-uuid-1',
    conceptTitle: '马尔可夫决策过程',
    question: '状态集合是什么？',
  }], [{
    document: {
      structure: {
        subjects: [{ id: 's-carrier-uuid-1', cardRef: 'cs-carrier-1' }],
        concepts: [{ id: 'n-concept-uuid-1', cardRef: 'cc-1', subjectId: 's-carrier-uuid-1' }],
      },
      data: {
        cards: [
          { id: 'cs-carrier-1', title: '强化学习导论' },
          { id: 'cc-1', title: '马尔可夫决策过程' },
        ],
      },
    },
  }])
  const carrier = graph.nodes.find((item) => item.kind === 'carrier')
  assert.equal(carrier?.label, '强化学习导论')
  assert.equal(graph.nodes.some((item) => item.label === 's-carrier-uuid-1'), false)
})

test('internal carrier ids are omitted instead of becoming the visible label', () => {
  const graph = projectAuthorNetworkGraph([{
    authorId: 'author-a',
    name: '作者甲',
    weight: 'high',
    carrierTitle: 's-carrier-uuid-1',
    conceptTitle: '马尔可夫决策过程',
    question: '状态集合是什么？',
  }])
  assert.equal(graph.nodes.some((item) => item.kind === 'carrier'), false)
  assert.equal(graph.nodes.some((item) => item.label === 's-carrier-uuid-1'), false)
  assert.equal(graph.nodes.some((item) => item.kind === 'concept' && item.label === '马尔可夫决策过程'), true)
})

test('shared carrier and concept stay one node; empty input stays empty', () => {
  const graph = projectAuthorNetworkGraph([
    {
      authorId: 'author-a',
      name: '作者甲',
      weight: 'high',
      carrierTitle: '数学基础',
      conceptTitle: 'Softmax',
      question: '什么是softmax?',
    },
    {
      authorId: 'author-c',
      name: '作者丙',
      weight: 'high',
      carrierTitle: '数学基础',
      conceptTitle: 'Softmax',
      question: '什么是softmax?',
    },
  ])
  assert.equal(graph.nodes.filter((item) => item.kind === 'carrier').length, 1)
  assert.equal(graph.nodes.filter((item) => item.kind === 'concept').length, 1)
  assert.equal(graph.nodes.filter((item) => item.kind === 'author').length, 2)
  assert.deepEqual(projectAuthorNetworkGraph([]), { nodes: [], edges: [] })
})
