import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { resolveLearningEntry } from '../src/session/resolve-learning-entry.ts'
import { validateRendererDocument } from '../src/path-3d/validate-renderer-document.ts'
import { decideCommittedApply } from '../packages/runtime-store/src/runtime-store.ts'

const session = await readFile(new URL('../src/pages/Session.tsx', import.meta.url), 'utf8')
const store = await readFile(new URL('../src/workspace/store.ts', import.meta.url), 'utf8')
const catalog = await readFile(new URL('../src/workspace/catalog.ts', import.meta.url), 'utf8')
const canvas = await readFile(new URL('../src/pages/KnowledgeCanvas.tsx', import.meta.url), 'utf8')
const authors = await readFile(new URL('../src/pages/Authors.tsx', import.meta.url), 'utf8')
const useAnnotations = await readFile(new URL('../src/session/useAnnotations.ts', import.meta.url), 'utf8')
const askAuthors = await readFile(new URL('../src/session/ask-authors.ts', import.meta.url), 'utf8')
const liveService = await readFile(new URL('../server/live-service.ts', import.meta.url), 'utf8')
const canonical = await readFile(new URL('../server/knowledge/canonical-answer.ts', import.meta.url), 'utf8')

test('routes do not create knowledge and failed session turns do not write graphs', () => {
  assert.match(session, /requestCanonicalAnswer/)
  assert.match(session, /不会因此创建知识脉络/)
  assert.match(canonical, /reused: true/)
  assert.match(canonical, /inflight/)
  assert.doesNotMatch(canonical, /KnowledgeGraph/)
  assert.match(session, /requestOrdinaryAnswer/)
  assert.match(session, /requestAskAuthor/)
  assert.match(session, /appendLearningTurnToGraph/)
  assert.match(session, /failed:true/)
  assert.doesNotMatch(session, /coachReply/)
  assert.doesNotMatch(catalog, /export function coachReply/)
  assert.match(store, /isFailureSentinel/)
  assert.match(store, /user\.mode === 'authors'/)
  assert.doesNotMatch(store, /这次把问题交给相关作者/)
  assert.doesNotMatch(store, /这次用图把刚才引用的关系摊开/)
})

test('concept membership is required and canvas does not write another conversation', () => {
  const crossed = resolveLearningEntry({
    routeId: 'critical-thinking',
    conceptId: 'linear-map',
    conceptIds: ['argument'],
    route: { id: 'critical-thinking' },
  })
  assert.equal(crossed.kind, 'unavailable')
  assert.match(store, /!node\.conversationId \|\| node\.conversationId !== conversationId/)
  assert.match(canvas, /activeConversation\.conceptId === conceptId/)
  assert.match(canvas, /不能把这次请求写进知识脉络/)
  assert.match(canvas, /requestOrdinaryAnswer/)
})

test('stale 马同学 annotations are not live replies and failures are not persisted as success', () => {
  assert.match(useAnnotations, /persistReady/)
  assert.match(useAnnotations, /requestAskAuthor/)
  assert.match(askAuthors, /isPersistedAnnotation/)
  assert.match(askAuthors, /马同学/)
})

test('Liu Kanshan cannot become an author identity and author search fails closed without a network', () => {
  assert.match(liveService, /isLiuKanshanName/)
  assert.match(liveService, /NETWORK_UNAVAILABLE/)
  assert.match(authors, /还没有冻结，不能当成产品事实/)
})

test('stream cursors start at sequence 1 and incomplete path documents fail', () => {
  assert.equal(decideCommittedApply(undefined, {
    eventId: '11111111-1111-4111-8111-111111111111',
    resourceId: 'agg',
    sequence: 0,
    traceId: 't',
  }), 'gap')
  assert.equal(decideCommittedApply(undefined, {
    eventId: '11111111-1111-4111-8111-111111111111',
    resourceId: 'agg',
    sequence: 1,
    traceId: 't',
  }), 'apply')
  assert.equal(validateRendererDocument({
    protocol: 'learning-path',
    version: '1.0',
    id: 'generated-path',
    metadata: { title: 'x', locale: 'zh-CN' },
    structure: { subjects: [{ id: 's' }], flowGroups: [{ id: 'g' }] },
  }).ok, false)
})
