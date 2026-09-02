import assert from 'node:assert/strict'
import test from 'node:test'
import { collapseParallelHosts, conversationGraphView, findMergeTarget, growGraph, similarQuestion } from './generate.ts'
import {
  GRAPH_CONTEXT_COMPRESSED_CONTENT,
  GRAPH_CONTEXT_FULL_LIMIT,
  packGraphContext,
  parseGrowDecision,
} from './grow-decision.ts'

const root = {
  id: 'root',
  accent: '#158f81',
  title: '向量空间',
  role: 'flow',
  turns: [{ question: '根问', replyKind: 'full', paragraphs: ['根答'] }],
}

test('quoted example questions parse as parallel with a card title and reason', () => {
  const decision = parseGrowDecision({
    kind: 'par',
    title: '二维平面的例子',
    reason: '举例是同一节点的并列问法。',
    mergeNodeId: 'g1',
  }, new Set(['g1']), { question: '举个例子吗', quote: '基不是装饰', hostTitle: '向量空间', palId: 'g1' })
  assert.equal(decision.kind, 'par')
  assert.equal(decision.title, '二维平面的例子')
  assert.match(decision.reason, /并列/)
  assert.equal(decision.mergeNodeId, 'g1')
  assert.equal(decision.source, 'model')
})

test('parallel always merges into the existing dashed card', () => {
  const first = growGraph([root], [], 'root', 'par', '另一种问法', '', {
    question: '另一种问法',
    replyKind: 'full',
    paragraphs: ['第一答'],
  }, 'c1')
  assert.ok(first)
  const second = growGraph(first.nodes, first.edges, 'root', 'par', '举个例子吗', '基不是装饰', {
    question: '举个例子吗',
    replyKind: 'full',
    paragraphs: ['例子答'],
  }, 'c1')
  assert.ok(second)
  const pals = second.nodes.filter((node) => node.role === 'parallel')
  assert.equal(pals.length, 1)
  assert.equal(pals[0]?.turns.length, 2)
  assert.equal(pals[0]?.turns[0]?.question, '另一种问法')
  assert.equal(pals[0]?.turns[1]?.question, '举个例子吗')
})

test('similar successor questions merge into the existing card instead of forking', () => {
  const first = growGraph([root], [], 'root', 'succ', '如何理解这组基', '基不是坐标轴装饰', {
    title: '如何理解这组基',
    question: '如何理解这组基',
    replyKind: 'full',
    paragraphs: ['第一答'],
  }, 'c1')
  assert.ok(first)
  assert.equal(similarQuestion('如何理解这组基', '如何理解这组基呢'), true)
  const target = findMergeTarget(first.nodes, first.edges, 'root', 'succ', '如何理解这组基呢', '基不是坐标轴装饰')
  assert.equal(target?.id, first.created.id)
  const second = growGraph(first.nodes, first.edges, 'root', 'succ', '如何理解这组基呢', '基不是坐标轴装饰', {
    question: '如何理解这组基呢',
    replyKind: 'full',
    paragraphs: ['第二答'],
  }, 'c1')
  assert.ok(second)
  assert.equal(second.nodes.filter((node) => node.id !== 'root').length, 1)
  assert.equal(second.created.turns.length, 2)
})

test('multiple dashed cards on one host collapse into a single stacked Q&A card', () => {
  const a = growGraph([root], [], 'root', 'par', '问法一', '', {
    question: '问法一',
    replyKind: 'full',
    paragraphs: ['答一'],
  }, 'c1')
  assert.ok(a)
  const duplicate = {
    ...a.created,
    id: 'g9',
    conversationId: 'c2',
    turns: [{ question: '问法二', replyKind: 'full', paragraphs: ['答二'] }],
  }
  const collapsed = collapseParallelHosts(
    [...a.nodes, duplicate],
    [...a.edges, { id: 'eg9', from: 'root', to: 'g9', kind: 'parallel', grow: 'par', reason: '并列' }],
  )
  const pals = collapsed.nodes.filter((node) => node.role === 'parallel')
  assert.equal(pals.length, 1)
  assert.equal(pals[0]?.turns.length, 2)
  assert.equal(collapsed.edges.filter((edge) => edge.kind === 'parallel').length, 1)
})

test('a hanging dashed card always has a parallel wire even if the stored edge is missing', () => {
  const view = conversationGraphView([
    root,
    {
      id: 'g1',
      accent: '#6b7280',
      title: '并列问法',
      role: 'parallel',
      hostId: 'root',
      grow: 'par',
      turns: [{ question: '解释一下', replyKind: 'full', paragraphs: ['答'] }],
    },
  ], [])
  assert.equal(view.edges.length, 1)
  assert.equal(view.edges[0]?.kind, 'parallel')
  assert.equal(view.edges[0]?.from, 'root')
  assert.equal(view.edges[0]?.to, 'g1')
})

test('unrelated successor questions still create a new node', () => {
  const first = growGraph([root], [], 'root', 'succ', '如何理解基', '', {
    question: '如何理解基',
    replyKind: 'full',
    paragraphs: ['第一答'],
  }, 'c1')
  assert.ok(first)
  const second = growGraph(first.nodes, first.edges, 'root', 'succ', '下一步怎么写成矩阵', '', {
    question: '下一步怎么写成矩阵',
    replyKind: 'full',
    paragraphs: ['矩阵答'],
  }, 'c1')
  assert.ok(second)
  assert.equal(second.nodes.filter((node) => node.id !== 'root').length, 2)
})

test('full graph context stays complete under the 220k budget and names the target card', () => {
  const packed = packGraphContext([root], [], 'root', '基不是坐标轴装饰')
  assert.equal(packed.mode, 'full')
  assert.match(packed.text, /当前问题针对节点卡片 root「向量空间」/)
  assert.match(packed.text, /连接结构/)
  assert.ok(packed.text.length < GRAPH_CONTEXT_FULL_LIMIT)
})

test('over-budget graphs keep structure, compress other cards, and keep the quoted node full', () => {
  const huge = {
    ...root,
    turns: [{ question: '长问', replyKind: 'full', paragraphs: ['答'.repeat(GRAPH_CONTEXT_FULL_LIMIT)] }],
  }
  const extra = {
    id: 'g1',
    accent: '#158f81',
    title: '后置节点',
    role: 'flow',
    grow: 'succ',
    turns: [{ question: '后置问', replyKind: 'full', paragraphs: ['后置答'] }],
  }
  const packed = packGraphContext([huge, extra], [{
    id: 'eg1',
    from: 'root',
    to: 'g1',
    kind: 'flow',
    grow: 'succ',
    reason: '后置',
  }], 'root')
  assert.equal(packed.mode, 'compressed')
  assert.match(packed.text, /完整连接结构/)
  assert.match(packed.text, /root -\[ 后置 \]-> g1/)
  assert.match(packed.text, /针对节点全文/)
  assert.ok(packed.text.includes('答'.repeat(100)))
  assert.ok(!packed.text.includes('后置答') || packed.text.indexOf('其他节点压缩') < packed.text.indexOf('针对节点全文'))
  assert.ok(packed.text.length > GRAPH_CONTEXT_COMPRESSED_CONTENT)
})
