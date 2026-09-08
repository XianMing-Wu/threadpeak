import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { mineRouteFromValidatedDocument } from '../workspace/published-route.ts'

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
