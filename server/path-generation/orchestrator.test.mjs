import assert from 'node:assert/strict'
import test from 'node:test'
import { createPathOrchestrator } from './orchestrator.ts'

const r1 = {
  queries: [
    { id: 'q1', text: '线性映射怎么学', angle: 'normal_learning' },
    { id: 'q2', text: '线性映射入门路径', angle: 'normal_learning' },
    { id: 'q3', text: '线性映射常见坑', angle: 'pitfall_or_dispute' },
    { id: 'q4', text: '线性映射误导学法', angle: 'pitfall_or_dispute' },
  ],
}

const r2 = {
  线性代数: {
    向量空间: { 争议: false },
    线性映射: { 争议: true },
  },
}

const r2Quiet = {
  线性代数: {
    线性映射: { 争议: false },
  },
}

const r3 = {
  round: 1,
  status: 'active',
  questions: [{
    id: 'qq1',
    prompt: '更想先看定义还是例子？',
    options: [
      { id: 'o1', label: '定义', routeEffect: '先放定义' },
      { id: 'o2', label: '例子', routeEffect: '先放例子' },
    ],
  }],
}

const r4 = {
  version: '1.0',
  routeId: 'route-live-1',
  title: '线性映射入门',
  carriers: [{ id: 'c1', title: '线性代数', description: '对象与运算' }],
  concepts: [{
    id: 'n1',
    carrierId: 'c1',
    title: '线性映射',
    hasDispute: true,
    detailedDescription: '讲清保运算',
    attachmentSourceIds: [],
  }],
  carrierEdges: [],
  conceptEdges: [],
  entryConceptIds: ['n1'],
  terminalConceptIds: ['n1'],
}

function evidence(queryId) {
  return {
    kind: 'hits',
    items: [{
      evidenceId: `ev-${queryId}`,
      authorId: 'https://www.zhihu.com/people/real',
      authorName: '真实作者',
      title: '线性映射',
      summary: '保持加法与数乘',
      url: `https://www.zhihu.com/question/${queryId}`,
    }],
  }
}

function orchestrator(overrides = {}) {
  const calls = []
  const started = []
  let release
  const gate = new Promise((resolve) => { release = resolve })
  const fixtures = {
    R1: r1,
    R2: r2,
    R3: r3,
    R4: r4,
    ...overrides.fixtures,
  }
  const api = createPathOrchestrator({
    async invokeStructured(agentId, context, options) {
      calls.push({ agentId, context, options })
      if (overrides.failAgent === agentId) {
        return { kind: 'failed', code: 'OUTPUT_INVALID', message: `${agentId} 失败`, agentId }
      }
      return { kind: 'completed', agentId, value: fixtures[agentId], compressed: false }
    },
    async invokeText(_agentId, context) {
      calls.push({ agentId: 'R5', context })
      return { kind: 'completed', agentId: 'R5', text: '发布后的普通回复', compressed: false }
    },
    async search(query) {
      started.push(query)
      if (started.length === r1.queries.length) release()
      await gate
      return evidence(query.slice(-2))
    },
    ...overrides.ports,
  })
  return { api, calls, started }
}

test('R1/R-S/R2/R3 run in order, searches are parallel, and attachments are visible to every agent', async () => {
  const attachment = { sourceId: 'att-1', fileName: 'note.txt', mimeType: 'text/plain', content: '讲义' }
  const { api, calls, started } = orchestrator()
  const view = await api.start({ goal: '线性映射入门', attachments: [attachment] })
  assert.equal(view.status, 'awaiting_answers')
  assert.equal(view.knowledgeCreated, false)
  assert.equal(view.questionSets[0].round, 1)
  assert.equal(started.length, 4)
  const agentOrder = calls.map((item) => item.agentId)
  assert.deepEqual(agentOrder.slice(0, 3), ['R1', 'R2', 'R3'])
  for (const agentId of ['R1', 'R2', 'R3']) {
    const call = calls.find((item) => item.agentId === agentId)
    assert.equal(call.context.attachments[0].sourceId, 'att-1')
  }
  assert.equal(calls.find((item) => item.agentId === 'R2').context.searchGroups.length, 4)
})

test('commit is blocked until the active set is complete, then R4 publishes without knowledge', async () => {
  const r4WithAtt = {
    ...r4,
    concepts: [{ ...r4.concepts[0], attachmentSourceIds: ['att-1'] }],
  }
  const { api, calls } = orchestrator({ fixtures: { R1: r1, R2: r2, R3: r3, R4: r4WithAtt } })
  const started = await api.start({ goal: '线性映射入门', attachments: [{ sourceId: 'att-1', fileName: 'note.txt', content: '讲义' }] })
  const early = await api.commit(started.runId)
  assert.equal(early.status, 'awaiting_answers')
  assert.match(early.error.message, /全部答完/)
  await api.select({ runId: started.runId, questionId: 'qq1', optionId: 'o1' })
  const published = await api.commit(started.runId)
  assert.equal(published.status, 'published')
  assert.equal(published.knowledgeCreated, false)
  assert.ok(published.document)
  assert.equal(published.document.protocol, 'learning-path')
  const r4Call = calls.find((item) => item.agentId === 'R4')
  assert.equal(r4Call.context.attachments[0].sourceId, 'att-1')
  assert.equal(r4Call.context.questionSets[0].selectedOptions[0].optionId, 'o1')
})

test('R3b can replace questions until round 3, old sets stay superseded, retry restarts at R1', async () => {
  const fixtures = {
    R1: r1,
    R2: r2,
    R3: r3,
    R4: r4,
    R3b: {
      kind: 'replace_questions',
      message: '按你的追问换题',
      round: 2,
      status: 'active',
      questions: [{
        id: 'qq2',
        prompt: '更想理论还是练习？',
        options: [
          { id: 'p1', label: '理论', routeEffect: '偏理论' },
          { id: 'p2', label: '练习', routeEffect: '偏练习' },
        ],
      }],
    },
  }
  const { api, calls } = orchestrator({ fixtures })
  const started = await api.start({ goal: '线性映射入门' })
  const replaced = await api.followUp({ runId: started.runId, message: '我想少看公式' })
  assert.equal(replaced.questionSets[0].status, 'superseded')
  assert.equal(replaced.questionSets[1].status, 'active')
  assert.equal(replaced.questionSets[1].round, 2)
  const r3b = calls.find((item) => item.agentId === 'R3b')
  assert.equal(r3b.context.activeRound, 1)

  const retried = await api.retry(started.runId)
  assert.equal(retried.status, 'awaiting_answers')
  assert.equal(retried.questionSets.length, 1)
  assert.equal(retried.questionSets[0].round, 1)
  assert.ok(calls.filter((item) => item.agentId === 'R1').length >= 2)
})

test('undisputed exploration skips R3 and still does not write knowledge', async () => {
  const { api, calls } = orchestrator({ fixtures: { R1: r1, R2: r2Quiet, R4: { ...r4, concepts: [{ ...r4.concepts[0], hasDispute: false, attachmentSourceIds: [] }] } } })
  const view = await api.start({ goal: '线性映射入门' })
  assert.equal(view.status, 'published')
  assert.equal(calls.some((item) => item.agentId === 'R3'), false)
  assert.equal(view.knowledgeCreated, false)
})

test('search provider failure does not publish a half-finished route', async () => {
  const { api } = orchestrator({
    ports: {
      search: async () => ({ kind: 'failed', message: 'down' }),
    },
  })
  const view = await api.start({ goal: '线性映射入门' })
  assert.equal(view.status, 'failed')
  assert.equal(view.document, undefined)
})

test('R5 is only available after publish', async () => {
  const { api } = orchestrator()
  const started = await api.start({ goal: '线性映射入门' })
  const tooEarly = await api.reply({ runId: started.runId, message: '还没发布' })
  assert.match(tooEarly.error.message, /发布后/)
  await api.select({ runId: started.runId, questionId: 'qq1', optionId: 'o1' })
  await api.commit(started.runId)
  const replied = await api.reply({ runId: started.runId, message: '矩阵和映射什么关系？' })
  assert.equal(replied.reply, '发布后的普通回复')
})
