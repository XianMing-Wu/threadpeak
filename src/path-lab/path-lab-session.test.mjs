import assert from 'node:assert/strict'
import test from 'node:test'
import { createPathLabSession } from './path-lab-session.ts'

const rendererDocument = {
  protocol: 'learning-path',
  version: '1.0',
  id: 'test-path',
  metadata: { title: '从概念到实作', locale: 'zh-CN' },
  structure: {
    entrySubjectId: 'subject-start',
    goalSubjectIds: ['subject-goal'],
    subjects: [
      { id: 'subject-start', cardRef: 'card-start' },
      { id: 'subject-goal', cardRef: 'card-goal' },
    ],
    concepts: [],
    flow: [{ id: 'flow-start-goal', fromSubjectId: 'subject-start', toSubjectId: 'subject-goal' }],
    flowGroups: [],
  },
  data: {
    cards: [
      { id: 'card-start', title: '开始', summary: '建立可执行的基线。' },
      { id: 'card-goal', title: '完成', summary: '交付可验证的作品。' },
    ],
    resources: [],
    actions: [],
  },
  presentation: { layout: { direction: 'top-to-bottom' } },
}

function passedEnvelope() {
  return {
    renderer_document: structuredClone(rendererDocument),
    quality_report: {
      passed: true,
      score: 1,
      issues: [],
      invariant_count: 20,
      repair_rounds: 0,
    },
    trace: {
      total_duration_ms: 823,
      degraded: false,
      stages: [],
      provider_call_count: 3,
      provider_call_budget: 8,
    },
    diagnostics: {
      degradation_codes: [],
      source_counts: { total: 6, zhihu: 4, anchor_documents: 1, independent: 3 },
    },
  }
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  }
}

function waitFor(session, predicate) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('timed out waiting for session view')), 1000)
    const unsubscribe = session.store.subscribe(() => {
      if (predicate(session.store.getSnapshot().view)) {
        clearTimeout(timeout)
        unsubscribe()
        resolve(session.store.getSnapshot().view)
      }
    })
    if (predicate(session.store.getSnapshot().view)) {
      clearTimeout(timeout)
      unsubscribe()
      resolve(session.store.getSnapshot().view)
    }
  })
}

test('successful lab JSON is published only after the quality gate', async () => {
  const session = createPathLabSession({
    fetch: async (url, init) => {
      assert.equal(url, '/api/paths/generate')
      assert.equal(init?.method, 'POST')
      assert.deepEqual(JSON.parse(init?.body ?? '{}'), { raw_goal: '学会线性代数', clarification_answers: [] })
      return jsonResponse(200, passedEnvelope())
    },
    now: () => 1000,
  })
  session.submitNewGoal('学会线性代数')
  const view = await waitFor(session, (next) => next.runState === 'ready')
  assert.equal(view.document?.id, 'test-path')
  assert.equal(view.publishedDiagnostics?.passed, true)
  session.teardown()
})

test('failed quality gate keeps the previous document', async () => {
  let calls = 0
  const failed = passedEnvelope()
  failed.quality_report.passed = false
  failed.quality_report.issues = [{ code: 'full_coverage_incomplete', severity: 'error' }]
  const session = createPathLabSession({
    fetch: async () => {
      calls += 1
      return jsonResponse(200, calls === 1 ? passedEnvelope() : failed)
    },
    now: () => 1000,
  })
  session.submitNewGoal('first')
  await waitFor(session, (next) => next.runState === 'ready')
  session.submitNewGoal('second')
  const view = await waitFor(session, (next) => next.runState === 'error')
  assert.equal(view.document?.id, 'test-path')
  assert.match(view.error, /质量门禁未通过/)
  session.teardown()
})

test('transport failure does not invent a path document', async () => {
  const session = createPathLabSession({
    fetch: async () => {
      throw new Error('ECONNREFUSED')
    },
    now: () => 1,
  })
  session.submitNewGoal('学会线性代数')
  const view = await waitFor(session, (next) => next.runState === 'error')
  assert.equal(view.document, undefined)
  assert.match(view.error, /无法连接本地路径生成服务/)
  session.teardown()
})

test('clarification_required stays a typed prompt, not a published path', async () => {
  const session = createPathLabSession({
    fetch: async () => jsonResponse(409, {
      code: 'clarification_required',
      clarification_question_id: 'q1',
      clarification_question: '你更想先掌握哪一类对象？',
      clarification_step: 1,
      clarification_total: 2,
      clarification_options: [
        { id: 'opt-a', label: '向量', instruction: '先从向量空间开始。' },
        { id: 'opt-b', label: '矩阵', instruction: '先从矩阵运算开始。' },
      ],
    }),
    now: () => 1,
  })
  session.submitNewGoal('学会线性代数')
  const view = await waitFor(session, (next) => next.runState === 'clarifying')
  assert.equal(view.document, undefined)
  assert.equal(view.clarification?.questionId, 'q1')
  assert.equal(view.error, '')
  session.teardown()
})
