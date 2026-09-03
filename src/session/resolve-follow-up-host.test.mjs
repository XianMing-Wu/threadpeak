import assert from 'node:assert/strict'
import test from 'node:test'
import {
  hostsOfRange,
  replyHostOfUserTurn,
  resolveFollowUpHost,
  turnAllowsSelection,
} from './resolve-follow-up-host.ts'

const root = { nodeId: 'root', content: '首轮正文。' }
const turns = [
  { role: 'user', text: '什么是核？' },
  { role: 'assistant', text: '核是被映到零的向量。', nodeId: 'g1' },
  { role: 'user', text: '举个例子' },
  { role: 'assistant', text: '例如投影。', nodeId: 'g2' },
  { role: 'user', text: '失败的问题' },
  { role: 'assistant', text: '直答失败', failed: true },
]

test('empty question cannot send', () => {
  const result = resolveFollowUpHost({ question: '  ', quote: '首轮正文。', root, turns })
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'empty-question')
})

test('no quote defaults host and quote to the latest successful LLM reply', () => {
  const result = resolveFollowUpHost({ question: '下一步学什么', root, turns })
  assert.equal(result.ok, true)
  assert.equal(result.hostNodeId, 'g2')
  assert.equal(result.explicitQuote, false)
  assert.equal(result.quote.nodeId, 'g2')
  assert.equal(result.quote.text, '例如投影。')
})

test('no turns yet defaults to the unique root lesson', () => {
  const result = resolveFollowUpHost({ question: '为什么要保运算', root })
  assert.equal(result.ok, true)
  assert.equal(result.hostNodeId, 'root')
  assert.equal(result.quote.text, '首轮正文。')
})

test('explicit card quote uses that card as host', () => {
  const result = resolveFollowUpHost({
    question: '再展开一点',
    quote: '核是被映到零的向量。',
    quoteFromId: 'g1',
    root,
    turns,
  })
  assert.equal(result.ok, true)
  assert.equal(result.hostNodeId, 'g1')
  assert.equal(result.explicitQuote, true)
})

test('selecting a user question maps host to that question\'s reply card', () => {
  const result = resolveFollowUpHost({
    question: '和刚才那个问题有关',
    quote: '什么是核？',
    quoteFromId: 'user:0',
    root,
    turns,
  })
  assert.equal(result.ok, true)
  assert.equal(result.hostNodeId, 'g1')
  assert.equal(replyHostOfUserTurn(turns, 0), 'g1')
  assert.equal(replyHostOfUserTurn(turns, 4), undefined)
})

test('failed rounds are not selectable and a clicked node is not a host', () => {
  assert.equal(turnAllowsSelection(turns, 5), false)
  assert.equal(turnAllowsSelection(turns, 4), false)
  assert.equal(turnAllowsSelection(turns, 3), true)
  assert.equal(turnAllowsSelection(turns, 2), true)
  const clicked = resolveFollowUpHost({ question: '点了另一张卡', root, turns })
  assert.equal(clicked.ok, true)
  assert.equal(clicked.hostNodeId, 'g2')
  assert.equal(hostsOfRange('g1', 'g2'), undefined)
  assert.equal(hostsOfRange('g1', 'g1'), 'g1')
})
