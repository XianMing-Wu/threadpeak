import assert from 'node:assert/strict'
import test from 'node:test'
import { createCompositionApp } from '../http.ts'
import { createCanonicalAnswerStore } from '../knowledge/canonical-answer.ts'
import { createGraphSurgeon } from '../knowledge/graph-surgeon.ts'
import { createFirstLearningOrchestrator } from './orchestrator.ts'

const okConfig = {
  ok: true,
  config: {
    zhihuAccessSecret: 'secret',
    zhihuApiBaseUrl: 'https://developer.zhihu.com',
    deepseekApiKey: 'key',
    deepseekBaseUrl: 'https://api.deepseek.com',
    deepseekModelName: 'deepseek-chat',
  },
}

const refusingHttp = async () => ({ ok: false, status: 503, text: async () => '' })

function mockFirstLearning() {
  return createFirstLearningOrchestrator({
    async invokeText(_agentId, _context, options) {
      return { kind: 'completed', agentId: 'L0a', text: `${options.angle} 正文`, compressed: false }
    },
    async invokeStructured() {
      return { kind: 'completed', agentId: 'L0b', value: { content: '整理后的首次回复。' }, compressed: false }
    },
  })
}

async function appWithFirstLearning(firstLearning = mockFirstLearning()) {
  const canonical = createCanonicalAnswerStore()
  const graph = createGraphSurgeon(canonical)
  const app = await createCompositionApp({
    config: okConfig,
    http: refusingHttp,
    canonical,
    graph,
    firstLearning,
  })
  return { app, firstLearning }
}

const concept = {
  routeId: 'lp-http',
  conceptId: 'n-linear-map',
  title: '线性映射',
  hasDispute: true,
  detailedDescription: '讲解应偏向保加法与数乘。',
}

test('GET 404 is missing, POST settles answer and root together, GET then reuses', async () => {
  const { app } = await appWithFirstLearning()
  const query = `?routeId=${concept.routeId}&conceptId=${concept.conceptId}`

  const missing = await app.inject({ method: 'GET', url: `/api/learning/first-entry${query}` })
  assert.equal(missing.statusCode, 404)
  assert.equal(JSON.parse(missing.body).kind, 'missing')
  assert.equal(JSON.parse(missing.body).message, undefined)

  const created = await app.inject({
    method: 'POST',
    url: '/api/learning/first-entry',
    headers: { 'content-type': 'application/json' },
    payload: concept,
  })
  assert.equal(created.statusCode, 200)
  let createdBody = JSON.parse(created.body)
  for (let i = 0; i < 50 && createdBody.kind === 'running'; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10))
    const polled = await app.inject({ method: 'GET', url: `/api/learning/first-entry${query}` })
    createdBody = JSON.parse(polled.body)
  }
  assert.equal(createdBody.kind, 'completed')
  assert.equal(createdBody.reused, true)
  assert.equal(createdBody.text, '整理后的首次回复。')
  assert.equal(createdBody.graph.root.title, '线性映射')
  assert.equal(createdBody.graph.root.role, 'root')
  assert.equal(createdBody.graph.canonicalContentHash, createdBody.contentHash)

  const reused = await app.inject({ method: 'GET', url: `/api/learning/first-entry${query}` })
  assert.equal(reused.statusCode, 200)
  const reusedBody = JSON.parse(reused.body)
  assert.equal(reusedBody.reused, true)
  assert.equal(reusedBody.contentHash, createdBody.contentHash)
  assert.equal(reusedBody.graph.graphId, createdBody.graph.graphId)

  const graphGet = await app.inject({ method: 'GET', url: `/api/learning/graph${query}` })
  assert.equal(graphGet.statusCode, 200)
  assert.equal(JSON.parse(graphGet.body).graphId, createdBody.graph.graphId)

  await app.close()
})

test('POST graph does not bootstrap independently when first-learning is wired', async () => {
  const { app } = await appWithFirstLearning()
  const before = await app.inject({
    method: 'POST',
    url: '/api/learning/graph',
    headers: { 'content-type': 'application/json' },
    payload: { routeId: concept.routeId, conceptId: concept.conceptId, title: concept.title },
  })
  assert.equal(before.statusCode, 409)
  assert.equal(JSON.parse(before.body).code, 'CANONICAL_MISSING')

  const created = await app.inject({
    method: 'POST',
    url: '/api/learning/first-entry',
    headers: { 'content-type': 'application/json' },
    payload: concept,
  })
  assert.equal(created.statusCode, 200)
  const query = `?routeId=${concept.routeId}&conceptId=${concept.conceptId}`
  let createdBody = JSON.parse(created.body)
  for (let i = 0; i < 50 && createdBody.kind === 'running'; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10))
    createdBody = JSON.parse((await app.inject({ method: 'GET', url: `/api/learning/first-entry${query}` })).body)
  }
  assert.equal(createdBody.kind, 'completed')

  const after = await app.inject({
    method: 'POST',
    url: '/api/learning/graph',
    headers: { 'content-type': 'application/json' },
    payload: { routeId: concept.routeId, conceptId: concept.conceptId, title: concept.title },
  })
  assert.equal(after.statusCode, 200)
  assert.equal(JSON.parse(after.body).reused, true)
  assert.equal(JSON.parse(after.body).graphId, createdBody.graph.graphId)

  await app.close()
})

test('GET running includes L0b draft text while organize bar is in flight', async () => {
  let release
  const gate = new Promise((resolve) => { release = resolve })
  const firstLearning = createFirstLearningOrchestrator({
    async invokeText(_agentId, _context, options) {
      return { kind: 'completed', agentId: 'L0a', text: `${options.angle} 正文`, compressed: false }
    },
    async invokeStructured(agentId, _context, options) {
      options?.onText?.('{"content":"向量与空间变换的核心是"}')
      await gate
      return { kind: 'completed', agentId, value: { content: '向量与空间变换的核心是：向量。' }, compressed: false }
    },
  })
  const { app } = await appWithFirstLearning(firstLearning)
  const query = `?routeId=${concept.routeId}&conceptId=${concept.conceptId}`
  const created = await app.inject({
    method: 'POST',
    url: '/api/learning/first-entry',
    headers: { 'content-type': 'application/json' },
    payload: concept,
  })
  assert.equal(created.statusCode, 200)
  let body = JSON.parse(created.body)
  for (let i = 0; i < 50 && !(body.kind === 'running' && body.draftText); i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10))
    body = JSON.parse((await app.inject({ method: 'GET', url: `/api/learning/first-entry${query}` })).body)
  }
  assert.equal(body.kind, 'running')
  assert.equal(body.draftText, '向量与空间变换的核心是')
  assert.ok(body.trace.some((step) => step.id === 'l0b' && step.status === 'running'))
  release()
  for (let i = 0; i < 50 && body.kind === 'running'; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10))
    body = JSON.parse((await app.inject({ method: 'GET', url: `/api/learning/first-entry${query}` })).body)
  }
  assert.equal(body.kind, 'completed')
  await app.close()
})

test('missing detailedDescription fails closed without settling', async () => {
  const { app, firstLearning } = await appWithFirstLearning()
  const created = await app.inject({
    method: 'POST',
    url: '/api/learning/first-entry',
    headers: { 'content-type': 'application/json' },
    payload: { routeId: concept.routeId, conceptId: concept.conceptId, title: concept.title },
  })
  assert.equal(created.statusCode, 400)
  assert.equal(JSON.parse(created.body).kind, 'failed')
  assert.equal(firstLearning.get(concept.routeId, concept.conceptId), undefined)
  await app.close()
})
