import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveProviderConfig } from './config.ts'
import { createLiveService } from './live-service.ts'
import { createUnavailableAuthorNetwork } from './ports.ts'

const evidence = [{
  title: '线性映射',
  url: 'https://www.zhihu.com/question/1',
  excerpt: '公开解释',
  authorName: '真实作者',
  authorKey: 'https://www.zhihu.com/people/real',
  authorUrl: 'https://www.zhihu.com/people/real',
}]

function service(overrides = {}) {
  return createLiveService({
    search: {
      async searchContent() {
        return { kind: 'hits', items: evidence }
      },
    },
    answer: {
      async answer() {
        return { kind: 'completed', text: '根据公开证据，先抓住映射的可加性。' }
      },
    },
    review: {
      async pick() {
        return { kind: 'selected', authorKeys: ['https://www.zhihu.com/people/real'], reasons: { 'https://www.zhihu.com/people/real': '相关公开回答' } }
      },
    },
    direct: {
      async answer() {
        return { kind: 'completed', text: '刘看山直达摘要' }
      },
    },
    network: createUnavailableAuthorNetwork(),
    ...overrides,
  })
}

test('missing provider env is a readiness failure, not a silent fallback', () => {
  const resolved = resolveProviderConfig({})
  assert.equal(resolved.ok, false)
  assert.equal(resolved.code, 'CONFIG_INVALID')
})

test('ordinary answers require both Zhihu and the model', async () => {
  const failedSearch = service({
    search: { async searchContent() { return { kind: 'failed', message: 'down' } } },
  })
  const searchFailure = await failedSearch.ordinaryAnswer({ question: '什么是线性映射？' })
  assert.equal(searchFailure.kind, 'failed')
  assert.equal(searchFailure.code, 'PROVIDER_UNAVAILABLE')

  const completed = await service().ordinaryAnswer({ question: '什么是线性映射？' })
  assert.equal(completed.kind, 'completed')
  assert.match(completed.text, /可加性/)
})

test('ask-author is Zhihu-first and never invents 刘看山 as an author', async () => {
  const resolved = await service().askAuthor({ question: '为什么？', quote: '线性映射保持加法' })
  assert.equal(resolved.kind, 'authors')
  assert.equal(resolved.authors[0].displayName, '真实作者')

  const none = service({
    review: { async pick() { return { kind: 'none' } } },
  })
  const direct = await none.askAuthor({ question: '为什么？', quote: '线性映射保持加法' })
  assert.equal(direct.kind, 'direct')

  const searchDown = service({
    search: { async searchContent() { return { kind: 'failed', message: 'down' } } },
  })
  const failed = await searchDown.askAuthor({ question: '为什么？', quote: '线性映射保持加法' })
  assert.equal(failed.kind, 'failed')
})

test('author search does not call Zhihu when the network projector failed', async () => {
  let zhihuCalls = 0
  const live = service({
    search: {
      async searchContent() {
        zhihuCalls += 1
        return { kind: 'hits', items: evidence }
      },
    },
  })
  const result = await live.authorSearch({ query: '线性代数' })
  assert.equal(result.kind, 'failed')
  assert.equal(result.code, 'NETWORK_UNAVAILABLE')
  assert.equal(zhihuCalls, 0)
})

test('author search uses Zhihu only after a real empty network', async () => {
  const live = service({
    network: {
      async searchRelated() {
        return { kind: 'empty' }
      },
    },
  })
  const result = await live.authorSearch({ query: '线性代数' })
  assert.equal(result.kind, 'results')
  assert.equal(result.origin, 'zhihu')
  assert.equal(result.authors.length, 1)
})
