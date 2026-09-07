import assert from 'node:assert/strict'
import test from 'node:test'
import { createStubSummarizer } from './compress.ts'
import { SHARED_SYSTEM_PREFIX, TOKEN_BUDGET } from './constants.ts'
import { prepareAgentCall } from './prepare.ts'
import { estimateTokens } from './tokens.ts'

const summarizer = createStubSummarizer()

test('calls under 500k stay uncompressed and keep the shared prefix', async () => {
  const context = {
    goal: '想搞懂线性映射',
    attachments: [{ sourceId: 'att-1', fileName: 'note.txt', mimeType: 'text/plain', content: '一小段讲义' }],
  }
  const original = structuredClone(context)
  const prepared = await prepareAgentCall({ agentId: 'R1', context, summarizer })
  assert.equal(prepared.compressed, false)
  assert.ok(prepared.estimatedTokens < TOKEN_BUDGET)
  assert.equal(prepared.messages[0].content.startsWith(SHARED_SYSTEM_PREFIX), true)
  assert.deepEqual(context, original)
})

test('non-attachment below 300k compresses attachments once and does not overwrite the original', async () => {
  const huge = '测'.repeat(520_000)
  const context = {
    goal: '想搞懂线性映射',
    attachments: [{ sourceId: 'att-1', fileName: 'book.txt', mimeType: 'text/plain', content: huge }],
  }
  const original = structuredClone(context)
  const prepared = await prepareAgentCall({ agentId: 'R1', context, summarizer })
  assert.equal(prepared.compressed, true)
  assert.ok(prepared.estimatedTokens < TOKEN_BUDGET)
  assert.equal(context.attachments[0].content, huge)
  assert.notEqual(prepared.context.attachments[0].content, huge)
  assert.match(prepared.context.attachments[0].content, /sourceId=att-1/)
  assert.equal(prepared.context.attachments[0].sourceId, 'att-1')
  assert.deepEqual(context, original)
})

test('oversized user intent requires partition rather than rewriting the goal', async () => {
  const context={goal:'测'.repeat(520_000),attachments:[]}
  const original=structuredClone(context)
  await assert.rejects(prepareAgentCall({agentId:'R1',context,summarizer}),/CONTEXT_REQUIRES_PARTITION/)
  assert.deepEqual(context,original)
})

test('G1 only compresses node content and keeps neighborhood grouping', async () => {
  const long = '答'.repeat(520_000)
  const context = {
    host: { nodeId: 'host-1', title: '线性映射', content: long, annotations: [{ annotationId: 'a1', type: 'author_comment', content: '批注', authorId: 'author-1', evidenceIds: ['ev1'] }] },
    siblings: [{ nodeId: 'sib-1', title: '并列', content: '短', annotations: [] }],
    predecessors: [],
    successors: [],
    edges: [{ edgeId: 'e1', fromNodeId: 'host-1', toNodeId: 'sib-1', explanation: '对照' }],
    question: { text: '能举个例子吗？', quote: { nodeId: 'host-1', text: '保加法' } },
  }
  const original = structuredClone(context)
  const prepared = await prepareAgentCall({ agentId: 'G1', context, summarizer })
  assert.equal(prepared.compressed, true)
  assert.equal(prepared.context.host.nodeId, 'host-1')
  assert.equal(prepared.context.siblings[0].nodeId, 'sib-1')
  assert.equal(prepared.context.edges[0].fromNodeId, 'host-1')
  assert.equal(prepared.context.host.annotations[0].authorId, 'author-1')
  assert.equal(prepared.context.question.text, '能举个例子吗？')
  assert.notEqual(prepared.context.host.content, long)
  assert.deepEqual(context, original)
})

test('L0b compresses the three angles separately and never returns a too-long error', async () => {
  const context = {
    conceptId: 'n2',
    title: '线性映射',
    detailedDescription: '偏向保运算',
    directAnswers: [
      { angle: 'concrete_explanation', content: '讲'.repeat(200_000) },
      { angle: 'dispute', content: '争'.repeat(200_000) },
      { angle: 'pitfalls', content: '坑'.repeat(200_000) },
    ],
  }
  const prepared = await prepareAgentCall({ agentId: 'L0b', context, summarizer })
  assert.equal(prepared.compressed, true)
  assert.ok(prepared.estimatedTokens < TOKEN_BUDGET)
  assert.equal(prepared.context.directAnswers[0].angle, 'concrete_explanation')
  assert.equal(prepared.context.directAnswers[1].angle, 'dispute')
  assert.equal(prepared.context.directAnswers[2].angle, 'pitfalls')
  assert.notEqual(prepared.context.directAnswers[0].content, context.directAnswers[0].content)
})

test('search evidence compression keeps authorId/evidenceId/url binding', async () => {
  const context = {
    question: '谁在讲线性映射？',
    remainingSlots: 2,
    excludedAuthorIds: ['keep-out'],
    candidates: [{
      authorId: 'author-1',
      authorName: '真实作者',
      evidence: [
        { evidenceId: 'ev-a', summary: '长'.repeat(400_000), url: 'https://www.zhihu.com/question/1' },
        { evidenceId: 'ev-b', summary: '也长'.repeat(150_000), url: 'https://www.zhihu.com/question/2' },
      ],
    }],
  }
  const prepared = await prepareAgentCall({ agentId: 'N2', context, summarizer })
  assert.equal(prepared.compressed, true)
  assert.equal(prepared.context.candidates[0].authorId, 'author-1')
  assert.equal(prepared.context.candidates[0].evidence[0].evidenceId, 'ev-a')
  assert.equal(prepared.context.candidates[0].evidence[1].url, 'https://www.zhihu.com/question/2')
  assert.equal(prepared.context.excludedAuthorIds[0], 'keep-out')
  assert.equal(prepared.context.remainingSlots, 2)
})

test('token estimate treats CJK as one token', () => {
  assert.equal(estimateTokens('测'.repeat(10)), 10)
  assert.ok(estimateTokens('abcd') >= 1)
})
