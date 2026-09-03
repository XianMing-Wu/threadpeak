import assert from 'node:assert/strict'
import test from 'node:test'
import { createCompositionApp } from '../http.ts'
import { createAuthorsOrchestrator } from './orchestrator.ts'
import { createInMemoryAuthorNetworkProjector, createUnavailableAuthorNetworkProjector } from './network.ts'

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

const evidence = {
  evidenceId: 'ev-1',
  authorId: 'https://www.zhihu.com/people/real',
  authorName: '真实作者',
  title: '线性映射',
  summary: '保持加法。',
  url: 'https://www.zhihu.com/question/1',
}

function mockAuthors(network = createInMemoryAuthorNetworkProjector()) {
  return createAuthorsOrchestrator({
    network,
    async invokeStructured(agentId, context) {
      if (agentId === 'A1' || agentId === 'N1') {
        return {
          kind: 'completed',
          agentId,
          value: { queries: [{ id: 'q1', text: '线性映射可加性' }, { id: 'q2', text: '线性映射为什么保持加法' }] },
          compressed: false,
        }
      }
      if (agentId === 'A2') {
        const first = context.candidates[0]
        const item = first.evidence[0]
        return {
          kind: 'completed',
          agentId,
          value: {
            status: 'selected',
            normalizedQuestion: '线性映射为什么必须保持加法？',
            selections: [{
              authorId: first.authorId,
              authorName: first.authorName,
              evidenceId: item.evidenceId,
              evidenceSummary: item.summary,
              evidenceUrl: item.url,
            }],
          },
          compressed: false,
        }
      }
      return {
        kind: 'completed',
        agentId,
        value: {
          selections: context.candidates.slice(0, context.remainingSlots).map((item) => ({
            authorId: item.authorId,
            authorName: item.authorName,
            evidenceId: item.evidence[0].evidenceId,
          })),
        },
        compressed: false,
      }
    },
    async invokeText() {
      return { kind: 'completed', agentId: 'A3', text: '我是刘看山。', compressed: false }
    },
    async search() {
      return { kind: 'hits', items: [evidence] }
    },
  })
}

async function appWith(authors = mockAuthors()) {
  return createCompositionApp({
    config: okConfig,
    http: async () => ({ ok: false, status: 503, text: async () => '' }),
    authors,
  })
}

const askPayload = {
  question: '为什么要保持加法？',
  selection: { text: '同时保持加法和数乘', anchor: 'root' },
  host: { nodeId: 'root', content: '线性映射同时保持加法和数乘。' },
  carrier: { id: 'carrier-foundation', title: '数学基础' },
  concept: { id: 'n-linear-map', title: '线性映射' },
}

test('POST /api/ask-author returns looked-up author cards and writes high-weight', async () => {
  const authors = mockAuthors()
  const app = await appWith(authors)
  const posted = await app.inject({
    method: 'POST',
    url: '/api/ask-author',
    headers: { 'content-type': 'application/json' },
    payload: askPayload,
  })
  assert.equal(posted.statusCode, 200)
  const body = JSON.parse(posted.body)
  assert.equal(body.kind, 'authors')
  assert.equal(body.authors[0].displayName, '真实作者')
  assert.equal(body.authors[0].evidenceUrl, 'https://www.zhihu.com/question/1')
  assert.match(body.authors[0].displayText, /详细内容可以阅读我的文章/)
  const network = await app.inject({ method: 'GET', url: '/api/authors/network' })
  const listed = JSON.parse(network.body)
  assert.equal(listed.kind, 'list')
  assert.equal(listed.authors[0].weight, 'high')
  assert.equal(listed.authors[0].conceptTitle, '线性映射')
  await app.close()
})

test('POST /api/ask-author without selection fails closed', async () => {
  const app = await appWith()
  const posted = await app.inject({
    method: 'POST',
    url: '/api/ask-author',
    headers: { 'content-type': 'application/json' },
    payload: { question: '为什么？', host: { nodeId: 'root', content: '正文' } },
  })
  assert.equal(posted.statusCode, 400)
  assert.equal(JSON.parse(posted.body).code, 'PROVIDER_INVALID')
  await app.close()
})

test('GET /api/authors/network is empty without enrolled authors, not a fake unavailable page', async () => {
  const app = await appWith()
  const listed = await app.inject({ method: 'GET', url: '/api/authors/network' })
  assert.equal(listed.statusCode, 200)
  const body = JSON.parse(listed.body)
  assert.equal(body.kind, 'list')
  assert.equal(body.authors.length, 0)
  await app.close()
})

test('POST /api/authors/search uses Zhihu after an empty but available network', async () => {
  const app = await appWith()
  const posted = await app.inject({
    method: 'POST',
    url: '/api/authors/search',
    headers: { 'content-type': 'application/json' },
    payload: { query: '线性映射加法' },
  })
  assert.equal(posted.statusCode, 200)
  const body = JSON.parse(posted.body)
  assert.equal(body.kind, 'results')
  assert.equal(body.authors[0].origin, 'zhihu')
  const listed = JSON.parse((await app.inject({ method: 'GET', url: '/api/authors/network' })).body)
  assert.equal(listed.authors[0].weight, 'low')
  await app.close()
})

test('POST /api/authors/search fails closed when the projector is unavailable', async () => {
  const app = await appWith(mockAuthors(createUnavailableAuthorNetworkProjector()))
  const posted = await app.inject({
    method: 'POST',
    url: '/api/authors/search',
    headers: { 'content-type': 'application/json' },
    payload: { query: '线性映射' },
  })
  assert.equal(posted.statusCode, 503)
  assert.equal(JSON.parse(posted.body).code, 'NETWORK_UNAVAILABLE')
  await app.close()
})
