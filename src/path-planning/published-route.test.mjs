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

test('entering a published route uses the stored record and re-reads the active route', () => {
  const store = readFileSync(new URL('../workspace/store.ts', import.meta.url), 'utf8')
  const nav = readFileSync(new URL('../workspace/nav.ts', import.meta.url), 'utf8')
  const stage = readFileSync(new URL('../path-3d/path-3d-stage.tsx', import.meta.url), 'utf8')
  const panel = readFileSync(new URL('./chat-route-panel.tsx', import.meta.url), 'utf8')
  assert.match(store, /item\.document\.id === key/)
  assert.match(store, /route\.document\.id === document\.id/)
  assert.match(nav, /const route = getRoute\(routeId\)/)
  assert.match(stage, /NAV_EVENT/)
  assert.match(panel, /readyRouteId/)
  assert.doesNotMatch(panel, /RouteReadyCard title=\{publishedTitle\} routeId=\{publishedId\}/)
})
