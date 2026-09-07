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
      if (started.length === 2) release()
      await gate
      return evidence(query.slice(-2))
    },
    ...overrides.ports,
  })
  return { api, calls, started }
}

test('R1/R-S/R2/R3 run in order, searches are two packed parallels, and attachments are visible to every agent', async () => {
  const attachment = { sourceId: 'att-1', fileName: 'note.txt', mimeType: 'text/plain', content: '讲义' }
  const { api, calls, started } = orchestrator()
  const view = await api.start({ goal: '线性映射入门', attachments: [attachment] })
  assert.equal(view.status, 'awaiting_answers')
  assert.equal(view.knowledgeCreated, false)
  assert.equal(view.questionSets[0].round, 1)
  assert.equal(started.length, 2)
  assert.ok(started.some((query) => query.includes('线性映射怎么学') && query.includes('线性映射入门路径')))
  assert.ok(started.some((query) => query.includes('线性映射常见坑') && query.includes('线性映射误导学法')))
  const agentOrder = calls.map((item) => item.agentId)
  assert.deepEqual(agentOrder.slice(0, 3), ['R1', 'R2', 'R3'])
  for (const agentId of ['R1', 'R2', 'R3']) {
    const call = calls.find((item) => item.agentId === agentId)
    assert.equal(call.context.attachments[0].sourceId, 'att-1')
  }
  assert.equal(calls.find((item) => item.agentId === 'R3').context.goal, '线性映射入门')
  assert.equal(calls.find((item) => item.agentId === 'R2').context.searchGroups.length, 2)
  const kinds = view.trace.map((step) => `${step.kind}:${step.title ?? ''}:${step.status}`)
  assert.ok(kinds.some((item) => item.startsWith('agent:拆成检索问题:done')))
  assert.ok(kinds.some((item) => item.startsWith('search:检索知乎:done')))
  assert.equal(view.trace.filter((step) => step.kind === 'search').length, 2)
  assert.equal(view.trace.some((step) => step.kind === 'think'), false)
})

test('commit is blocked until the active set is complete; last select auto-publishes without knowledge', async () => {
  const r4WithAtt = {
    ...r4,
    concepts: [{ ...r4.concepts[0], attachmentSourceIds: ['att-1'] }],
  }
  const r3Two = {
    round: 1,
    status: 'active',
    questions: [
      r3.questions[0],
      {
        id: 'qq2',
        prompt: '更想先看日常还是长期？',
        options: [
          { id: 'p1', label: '日常', routeEffect: '偏日常收支' },
          { id: 'p2', label: '长期', routeEffect: '偏长期规划' },
        ],
      },
    ],
  }
  const { api, calls } = orchestrator({ fixtures: { R1: r1, R2: r2, R3: r3Two, R4: r4WithAtt } })
  const started = await api.start({ goal: '线性映射入门', attachments: [{ sourceId: 'att-1', fileName: 'note.txt', content: '讲义' }] })
  const early = await api.commit(started.runId)
  assert.equal(early.status, 'awaiting_answers')
  assert.match(early.error.message, /全部答完/)
  const first = await api.select({ runId: started.runId, questionId: 'qq1', optionId: 'o1' })
  assert.equal(first.status, 'awaiting_answers')
  assert.equal(first.trace.some((step) => step.kind === 'confirm' && step.title === '已确认：定义'), true)
  assert.equal(calls.some((item) => item.agentId === 'R4'), false)
  const published = await api.select({ runId: started.runId, questionId: 'qq2', optionId: 'p1' })
  assert.equal(published.status, 'published')
  assert.equal(published.trace.filter((step) => step.kind === 'confirm').length, 2)
  assert.ok(published.trace.some((step) => step.title === '已确认：日常'))
  assert.equal(published.knowledgeCreated, false)
  assert.ok(published.document)
  assert.equal(published.document.protocol, 'learning-path')
  const r4Call = calls.find((item) => item.agentId === 'R4')
  assert.equal(r4Call.context.goal, '线性映射入门')
  assert.equal(r4Call.context.attachments[0].sourceId, 'att-1')
  assert.equal(r4Call.context.questionSets[0].selectedOptions[0].optionId, 'o1')
  const again = await api.commit(started.runId)
  assert.equal(again.status, 'published')
})

test('deep R4 provider failure regenerates the route without thinking', async () => {
  const thinking = []
  const { api } = orchestrator({
    ports: {
      async invokeStructured(agentId, _context, options) {
        if (agentId === 'R4') thinking.push(options?.thinkingDepth ?? 'fast')
        if (agentId === 'R4' && thinking.length === 1) {
          return { kind: 'failed', code: 'PROVIDER_UNAVAILABLE', message: '模型服务不可用。', agentId }
        }
        const fixtures = { R1: r1, R2: r2, R3: r3, R4: r4 }
        return { kind: 'completed', agentId, value: fixtures[agentId], compressed: false }
      },
    },
  })
  const started = await api.start({ goal: '线性映射入门', thinkingDepth: 'deep' })
  const published = await api.select({ runId: started.runId, questionId: 'qq1', optionId: 'o1' })
  assert.equal(published.status, 'published', published.error?.message ?? '')
  assert.deepEqual(thinking, ['deep', 'fast'])
})

test('failed R4 retries only generate-route and keeps earlier bars', async () => {
  let r4Calls = 0
  const { api, calls } = orchestrator({
    ports: {
      async invokeStructured(agentId, context) {
        calls.push({ agentId, context })
        if (agentId === 'R4') {
          r4Calls += 1
          if (r4Calls <= 2) {
            return { kind: 'failed', code: 'OUTPUT_INVALID', message: 'R4 失败', agentId }
          }
        }
        const fixtures = { R1: r1, R2: r2, R3: r3, R4: r4 }
        return { kind: 'completed', agentId, value: fixtures[agentId], compressed: false }
      },
    },
  })
  const started = await api.start({ goal: '线性映射入门' })
  const failed = await api.select({ runId: started.runId, questionId: 'qq1', optionId: 'o1' })
  assert.equal(failed.status, 'failed')
  assert.equal(failed.trace.find((step) => step.id === 'r1')?.status, 'done')
  assert.equal(failed.trace.find((step) => step.id === 'r4')?.status, 'failed')
  const retried = await api.retry(started.runId)
  assert.equal(retried.status, 'published')
  assert.equal(calls.filter((item) => item.agentId === 'R1').length, 1)
  assert.equal(r4Calls, 3)
  assert.equal(retried.trace.find((step) => step.id === 'r1')?.status, 'done')
  assert.equal(retried.trace.find((step) => step.id === 'r4')?.status, 'done')
  assert.ok(retried.trace.some((step) => step.kind === 'confirm'))
})

test('R3b can replace questions until round 3, old sets stay superseded, retry keeps R1 and regenerates questions', async () => {
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
  assert.equal(r3b.context.goal, '线性映射入门')

  const retried = await api.retry(started.runId)
  assert.equal(retried.status, 'awaiting_answers')
  assert.equal(calls.filter((item) => item.agentId === 'R1').length, 1)
  assert.ok(calls.filter((item) => item.agentId === 'R3').length >= 2)
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
  const published = await api.select({ runId: started.runId, questionId: 'qq1', optionId: 'o1' })
  assert.equal(published.status, 'published')
  const replied = await api.reply({ runId: started.runId, message: '矩阵和映射什么关系？' })
  assert.equal(replied.reply, '发布后的普通回复')
})

test('wait:false returns a running snapshot with the R1 agent bar, then GET settles', async () => {
  const { api } = orchestrator()
  const view = await api.start({ goal: '线性映射入门', wait: false })
  assert.equal(view.status, 'running')
  assert.equal(view.trace[0].kind, 'agent')
  assert.equal(view.trace[0].title, '拆成检索问题')
  assert.equal(view.trace[0].status, 'running')
  const settled = await new Promise((resolve, reject) => {
    const startedAt = Date.now()
    const tick = () => {
      const next = api.get(view.runId)
      if (!next) {
        reject(new Error('missing run'))
        return
      }
      if (next.status !== 'running') {
        resolve(next)
        return
      }
      if (Date.now() - startedAt > 3000) {
        reject(new Error('still running'))
        return
      }
      setTimeout(tick, 10)
    }
    tick()
  })
  assert.equal(settled.status, 'awaiting_answers')
  assert.ok(settled.trace.some((step) => step.kind === 'search' && step.status === 'done'))
  assert.ok(settled.trace.some((step) => step.kind === 'agent' && step.title === '生成选择题' && step.status === 'done'))
})

test('deep thinking failure after reasoning keeps the think bar completed', async () => {
  const { api } = orchestrator({
    ports: {
      async invokeStructured(agentId, _context, options) {
        options?.onReasoning?.(`推理 ${agentId}`)
        return { kind: 'failed', code: 'PROVIDER_UNAVAILABLE', message: '模型服务返回了空内容。', agentId }
      },
    },
  })
  const view = await api.start({ goal: '线性映射入门', thinkingDepth: 'deep' })
  assert.equal(view.status, 'failed')
  const think = view.trace.filter((step) => step.kind === 'think')
  assert.equal(think.length, 1)
  assert.equal(think[0].status, 'done')
  assert.match(think[0].thought ?? '', /推理/)
  assert.equal(view.trace.find((step) => step.id === 'r1')?.status, 'failed')
})

test('deep thinking records a streamed think bar only after reasoning arrives', async () => {
  const { api } = orchestrator({
    ports: {
      async invokeStructured(agentId, _context, options) {
        options?.onReasoning?.(`推理 ${agentId}`)
        const fixtures = { R1: r1, R2: r2, R3: r3, R4: r4 }
        return { kind: 'completed', agentId, value: fixtures[agentId], compressed: false }
      },
    },
  })
  const view = await api.start({ goal: '线性映射入门', thinkingDepth: 'deep' })
  const think = view.trace.filter((step) => step.kind === 'think')
  assert.ok(think.length >= 1)
  assert.ok(think.every((step) => step.status === 'done'))
  assert.match(think[0].thought ?? '', /推理/)
  assert.ok(view.trace.some((step) => step.kind === 'agent' && step.title === '拆成检索问题'))
  assert.ok(view.trace.some((step) => step.kind === 'search'))
})
