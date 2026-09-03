import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { resolveLearningEntry } from '../src/session/resolve-learning-entry.ts'
import { validateRendererDocument } from '../src/path-3d/validate-renderer-document.ts'
import { decideCommittedApply } from '../packages/runtime-store/src/runtime-store.ts'

const appPage = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
const session = await readFile(new URL('../src/pages/Session.tsx', import.meta.url), 'utf8')
const notFound = await readFile(new URL('../src/pages/NotFound.tsx', import.meta.url), 'utf8')
const store = await readFile(new URL('../src/workspace/store.ts', import.meta.url), 'utf8')
const catalog = await readFile(new URL('../src/workspace/catalog.ts', import.meta.url), 'utf8')
const canvas = await readFile(new URL('../src/pages/KnowledgeCanvas.tsx', import.meta.url), 'utf8')
const authors = await readFile(new URL('../src/pages/Authors.tsx', import.meta.url), 'utf8')
const useAnnotations = await readFile(new URL('../src/session/useAnnotations.ts', import.meta.url), 'utf8')
const askAuthors = await readFile(new URL('../src/session/ask-authors.ts', import.meta.url), 'utf8')
const annotationPanel = await readFile(new URL('../src/components/AnnotationPanel.tsx', import.meta.url), 'utf8')
const mineGraph = await readFile(new URL('../src/knowledge-canvas/mine-graph-canvas.tsx', import.meta.url), 'utf8')
const bootstrapped = await readFile(new URL('../src/knowledge-canvas/project-bootstrapped-graph.ts', import.meta.url), 'utf8')
const authorsOrchestrator = await readFile(new URL('../server/authors/orchestrator.ts', import.meta.url), 'utf8')
const canonical = await readFile(new URL('../server/knowledge/canonical-answer.ts', import.meta.url), 'utf8')
const surgeon = await readFile(new URL('../server/knowledge/graph-surgeon.ts', import.meta.url), 'utf8')
const http = await readFile(new URL('../server/http.ts', import.meta.url), 'utf8')
const pkg = await readFile(new URL('../package.json', import.meta.url), 'utf8')

test('routes do not create knowledge and failed session turns do not write graphs', () => {
  assert.match(session, /requestFirstEntry/)
  assert.match(session, /requestFirstEntrySnapshot/)
  assert.doesNotMatch(session, /requestGraphBootstrap/)
  assert.doesNotMatch(session, /正在创建知识脉络根节点/)
  assert.match(session, /NotFoundPage/)
  assert.match(appPage, /not-found/)
  assert.match(notFound, /页面不存在/)
  assert.doesNotMatch(notFound, /无法进入这次学习/)
  assert.match(canonical, /reused: true/)
  assert.match(canonical, /inflight/)
  assert.doesNotMatch(canonical, /KnowledgeGraph/)
  assert.match(surgeon, /CANONICAL_MISSING/)
  assert.match(surgeon, /role: 'root'/)
  assert.match(surgeon, /revision: 1/)
  assert.doesNotMatch(surgeon, /ordinaryAnswer|generateStructured|growGraph/)
  assert.match(http, /LISTEN_PORT = 4312/)
  assert.doesNotMatch(http, /5033/)
  assert.match(pkg, /vite --host 127\.0\.0\.1 --port 4301/)
  assert.doesNotMatch(pkg, /port 5032/)
  assert.match(session, /requestFollowUp/)
  assert.match(session, /appendFollowUpTurn/)
  assert.doesNotMatch(session, /requestOrdinaryAnswerStream/)
  assert.match(session, /failed:true/)
  assert.doesNotMatch(session, /coachReply/)
  assert.doesNotMatch(catalog, /export function coachReply/)
  assert.match(store, /isFailureSentinel/)
  assert.match(store, /user\.mode === 'visual' \|\| assistant\.mode === 'visual'/)
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
  assert.match(store, /\^g\\d\+\$/)
  assert.match(canvas, /latestLearningConversation/)
  assert.match(canvas, /requestFollowUp/)
  assert.match(canvas, /appendFollowUpTurn/)
})

test('stale 马同学 annotations are not live replies and failures are not persisted as success', () => {
  assert.match(useAnnotations, /persistReady/)
  assert.match(useAnnotations, /requestAskAuthor/)
  assert.match(useAnnotations, /applyAskAuthorResult/)
  assert.match(useAnnotations, /liu-kanshan-direct/)
  assert.match(useAnnotations, /onSettled/)
  assert.doesNotMatch(useAnnotations, /没有可信作者时刘看山直达不能写入博主批注/)
  assert.match(askAuthors, /isPersistedAnnotation/)
  assert.match(askAuthors, /findQuoteSpan/)
  assert.match(askAuthors, /panelOpen: false/)
  assert.match(useAnnotations, /current\.panelOpen/)
  assert.match(canvas, /annotations\.close\(\)/)
  assert.match(askAuthors, /马同学/)
  assert.match(askAuthors, /liu-kanshan-direct/)
  assert.match(askAuthors, /liuKanshanDirectReply/)
  assert.match(canvas, /knowledge\?\.routeId \|\| knowledgeId/)
  assert.match(canvas, /ensureLearningConversation/)
  assert.match(canvas, /conversationGraphView\(nodes, edges\)/)
  assert.doesNotMatch(canvas, /conversationGraphView\(nodes, edges, sessionConversationId/)
  assert.match(session, /annotationScopeId\(routeId, conceptId\)/)
  assert.match(askAuthors, /annotationScopeId/)
  assert.match(annotationPanel, /刘看山直达/)
  assert.match(annotationPanel, /不是博主身份/)
  assert.match(annotationPanel, /MarkdownMath source=\{item\.text/)
  assert.match(annotationPanel, />详细内容可以阅读我的文章</)
  assert.doesNotMatch(annotationPanel, /<p className="annotation-card__reply">\{item\.text/)
  assert.doesNotMatch(annotationPanel, /<strong>\{item\.title\}/)
  assert.doesNotMatch(annotationPanel, /annotation-card__avatar[\s\S]{0,80}刘看山/)
})

test('mine canvas projects the settled first answer onto the unique GraphSurgeon root', () => {
  assert.match(mineGraph, /requestGraphSnapshot/)
  assert.match(mineGraph, /requestCanonicalSnapshot/)
  assert.match(mineGraph, /ensureMineKnowledgeFromCanonical/)
  assert.match(mineGraph, /KnowledgeCanvasPage/)
  assert.match(mineGraph, /dropMineConceptGraph/)
  assert.match(mineGraph, /closeConceptKnowledge/)
  assert.doesNotMatch(mineGraph, /requestCanonicalAnswer/)
  assert.doesNotMatch(mineGraph, /growGraph/)
  assert.doesNotMatch(mineGraph, /无法打开这次知识脉络/)
  assert.doesNotMatch(mineGraph, /GraphSurgeon/)
  assert.match(bootstrapped, /lessonFromCanonical/)
  assert.match(bootstrapped, /canonicalContentHash/)
  assert.doesNotMatch(bootstrapped, /结构锚点/)
  assert.doesNotMatch(surgeon, /ordinaryAnswer|generateStructured|growGraph/)
})

test('Liu Kanshan cannot become an author identity and author search fails closed without a network', () => {
  assert.match(authorsOrchestrator, /isLiuKanshanName/)
  assert.match(authors, /载体层下是概念层，概念层下是问题层/)
  assert.match(authors, /还没有入网博主/)
  assert.match(authors, /requestAuthorNetwork/)
  assert.match(authors, /AuthorNetworkGraph/)
  assert.match(store, /titleFromPathLayer/)
  assert.doesNotMatch(authors, /seedAuthorNetwork|hydrateNetworkFromAnnotations/)
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
