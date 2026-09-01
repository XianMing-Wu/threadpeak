import assert from 'node:assert/strict'
import test from 'node:test'
import { mineRouteFromValidatedDocument } from '../workspace/published-route.ts'
import { createPathGenerateSession } from './path-generate-session.ts'

const rendererDocument = {
  protocol: 'learning-path',
  version: '1.0',
  id: 'generated-path',
  metadata: { title: '从目标到可验证作品', locale: 'zh-CN', description: '真实生成结果' },
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

function waitFor(session, predicate) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('timed out waiting for generate session')), 1000)
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

test('user-triggered mine routes require a validated learning-path document', () => {
  assert.throws(
    () => mineRouteFromValidatedDocument('学会线性代数', 'chat-1', { ...rendererDocument, protocol: 'other' }, 1),
    /validated renderer document/,
  )
  const route = mineRouteFromValidatedDocument('学会线性代数', 'chat-1', rendererDocument, 11)
  assert.equal(route.owner, 'mine')
  assert.equal(route.knowledgeId, null)
  assert.equal(route.id, 'generated-path')
  assert.equal(route.document, rendererDocument)
  assert.equal(route.createdAt, 11)
})

test('Chat generate session transport failure does not invent a path document', async () => {
  const session = createPathGenerateSession({
    fetch: async () => {
      throw new Error('ECONNREFUSED')
    },
    now: () => 1,
  })
  session.submitNewGoal('给我制定一条机器学习数学路线')
  const view = await waitFor(session, (next) => next.runState === 'error')
  assert.equal(view.document, undefined)
  assert.match(view.error, /无法连接本地路径生成服务/)
  session.teardown()
})
