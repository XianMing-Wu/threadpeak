import assert from 'node:assert/strict'
import test from 'node:test'
import { createAuthorsOrchestrator, groupAuthorCandidates } from './orchestrator.ts'
import { createInMemoryAuthorNetworkProjector, createUnavailableAuthorNetworkProjector } from './network.ts'

const host = { nodeId: 'root', content: '线性映射同时保持加法和数乘。' }
const askBase = {
  question: '这段为什么说要同时保持加法？',
  selection: { text: '同时保持加法和数乘', anchor: 'root' },
  host,
  carrier: { id: 'carrier-foundation', title: '数学基础' },
  concept: { id: 'n-linear-map', title: '线性映射' },
}

const evidenceA = {
  evidenceId: 'ev-a',
  authorId: 'https://www.zhihu.com/people/a',
  authorName: '作者甲',
  title: '可加性',
  summary: '线性映射必须保持向量加法。',
  url: 'https://www.zhihu.com/question/1',
}
const evidenceB = {
  evidenceId: 'ev-b',
  authorId: 'https://www.zhihu.com/people/b',
  authorName: '作者乙',
  title: '数乘',
  summary: '线性映射还要保持数乘。',
  url: 'https://www.zhihu.com/question/2',
}
const evidenceC = {
  evidenceId: 'ev-c',
  authorId: 'https://www.zhihu.com/people/c',
  authorName: '作者丙',
  title: '矩阵',
  summary: '矩阵就是线性映射的坐标写法。',
  url: 'https://www.zhihu.com/question/3',
}

function a1Value() {
  return {
    queries: [
      { id: 'ask-query-1', text: '线性映射为什么要保持加法' },
      { id: 'ask-query-2', text: '线性映射可加性是什么意思' },
    ],
  }
}

function n1Value() {
  return {
    queries: [
      { id: 'author-query-1', text: '线性代数博主' },
      { id: 'author-query-2', text: '谁在讲线性映射' },
    ],
  }
}

function orchestrator(overrides = {}) {
  const calls = []
  const searches = []
  const network = overrides.network ?? createInMemoryAuthorNetworkProjector()
  const api = createAuthorsOrchestrator({
    network,
    async invokeStructured(agentId, context, options) {
      calls.push({ agentId, context, options })
      if (overrides.fail?.[agentId]) {
        return { kind: 'failed', code: overrides.fail[agentId].code ?? 'OUTPUT_INVALID', message: overrides.fail[agentId].message ?? `${agentId} 失败`, agentId }
      }
      if (agentId === 'A1') return { kind: 'completed', agentId, value: overrides.a1 ?? a1Value(), compressed: false }
      if (agentId === 'A2') {
        if (overrides.a2 === 'none') {
          return {
            kind: 'completed',
            agentId,
            value: { status: 'no_suitable_author', normalizedQuestion: '线性映射为什么必须同时保持加法？', selections: [] },
            compressed: false,
          }
        }
        const candidates = context.candidates ?? []
        const first = candidates[0]
        const evidence = first?.evidence?.[0]
        return {
          kind: 'completed',
          agentId,
          value: {
            status: 'selected',
            normalizedQuestion: '线性映射为什么必须同时保持加法？',
            selections: first && evidence
              ? [{
                authorId: first.authorId,
                authorName: first.authorName,
                evidenceId: evidence.evidenceId,
                evidenceSummary: evidence.summary,
                evidenceUrl: evidence.url,
              }]
              : [],
          },
          compressed: false,
        }
      }
      if (agentId === 'N1') return { kind: 'completed', agentId, value: n1Value(), compressed: false }
      if (agentId === 'N2') {
        const remaining = options.parseInput?.remainingSlots ?? 3
        const selected = (context.candidates ?? []).slice(0, remaining).map((item) => ({
          authorId: item.authorId,
          authorName: item.authorName,
          evidenceId: item.evidence[0].evidenceId,
        }))
        return { kind: 'completed', agentId, value: { selections: selected }, compressed: false }
      }
      throw new Error(`unexpected ${agentId}`)
    },
    async invokeText(agentId, context) {
      calls.push({ agentId, context })
      if (overrides.fail?.A3) {
        return { kind: 'failed', code: 'PROVIDER_UNAVAILABLE', message: '直答失败', agentId }
      }
      return { kind: 'completed', agentId, text: '我是刘看山。这段说的是可加性。', compressed: false }
    },
    async search(query) {
      searches.push(query)
      if (overrides.searchFail) return { kind: 'failed', message: 'down' }
      if (overrides.searchEmpty) return { kind: 'empty' }
      const items = overrides.searchItems ?? [evidenceA, evidenceB]
      return { kind: 'hits', items }
    },
  })
  return { api, calls, searches, network }
}

test('A1 splits 2–3 queries and A-S searches at most two packed queries', async () => {
  const { api, calls, searches } = orchestrator()
  const result = await api.ask(askBase)
  assert.equal(result.kind, 'authors')
  const a1 = calls.find((item) => item.agentId === 'A1')
  assert.equal(a1.context.question, askBase.question)
  assert.equal(a1.context.selection.text, askBase.selection.text)
  assert.equal(a1.context.host.nodeId, 'root')
  assert.equal(searches.length, 2)
  assert.equal(result.authors.length, 1)
  assert.equal(result.authors[0].authorName, '作者甲')
  assert.match(result.authors[0].displayText, /详细内容可以阅读我的文章 https:\/\/www\.zhihu\.com\/question\/1/)
})

test('A-S packs a third query into two space-joined searches', async () => {
  const { api, searches } = orchestrator({
    a1: {
      queries: [
        { id: 'ask-query-1', text: '线性映射为什么要保持加法' },
        { id: 'ask-query-2', text: '线性映射可加性是什么意思' },
        { id: 'ask-query-3', text: '线性映射同时保持加法与数乘' },
      ],
    },
  })
  const result = await api.ask(askBase)
  assert.equal(result.kind, 'authors')
  assert.equal(searches.length, 2)
  assert.ok(searches.some((query) => query.includes('线性映射为什么要保持加法') && query.includes('线性映射可加性是什么意思')))
  assert.ok(searches.some((query) => query.includes('线性映射同时保持加法与数乘')))
})

test('A2 selected looks up original evidence and writes high-weight records', async () => {
  const { api, network, calls } = orchestrator()
  const result = await api.ask(askBase)
  assert.equal(result.kind, 'authors')
  assert.equal(result.authors[0].evidenceSummary, '线性映射必须保持向量加法。')
  assert.equal(result.authors[0].evidenceUrl, 'https://www.zhihu.com/question/1')
  const a2 = calls.find((item) => item.agentId === 'A2')
  assert.equal(a2.options.parseInput.candidates[0].authorId, evidenceA.authorId)
  const listed = network.list()
  assert.equal(listed.length, 1)
  assert.equal(listed[0].weight, 'high')
  assert.equal(listed[0].carrierTitle, '数学基础')
  assert.equal(listed[0].conceptTitle, '线性映射')
  assert.equal(listed[0].question, '线性映射为什么必须同时保持加法？')
})

test('A2 no_suitable_author calls A3 and does not write the network', async () => {
  const { api, calls, network } = orchestrator({ a2: 'none' })
  const result = await api.ask(askBase)
  assert.equal(result.kind, 'direct')
  assert.match(result.text, /我是刘看山/)
  assert.equal(calls.some((item) => item.agentId === 'A3'), true)
  const a3 = calls.find((item) => item.agentId === 'A3')
  assert.equal(a3.context.question, askBase.question)
  assert.equal(a3.context.selection, askBase.selection.text)
  assert.equal(a3.context.candidates, undefined)
  assert.equal(network.list().length, 0)
})

test('A2 provider or structure failure is not zero-authors and must not call A3', async () => {
  const { api, calls, network } = orchestrator({ fail: { A2: { code: 'OUTPUT_INVALID', message: '结构失败' } } })
  const result = await api.ask(askBase)
  assert.equal(result.kind, 'failed')
  assert.equal(result.code, 'OUTPUT_INVALID')
  assert.equal(calls.some((item) => item.agentId === 'A3'), false)
  assert.equal(network.list().length, 0)
})

test('A1 or Zhihu search failure does not fall back to Liu Kanshan', async () => {
  const a1Fail = orchestrator({ fail: { A1: { code: 'PROVIDER_UNAVAILABLE', message: 'A1 失败' } } })
  const a1 = await a1Fail.api.ask(askBase)
  assert.equal(a1.kind, 'failed')
  assert.equal(a1Fail.searches.length, 0)
  assert.equal(a1Fail.calls.some((item) => item.agentId === 'A3'), false)

  const searchFail = orchestrator({ searchFail: true })
  const failed = await searchFail.api.ask(askBase)
  assert.equal(failed.kind, 'failed')
  assert.equal(failed.code, 'PROVIDER_UNAVAILABLE')
  assert.equal(searchFail.calls.some((item) => item.agentId === 'A2' || item.agentId === 'A3'), false)
})

test('ask-authors requires a selection and a question', async () => {
  const { api, calls } = orchestrator()
  const missingQuote = await api.ask({ ...askBase, selection: { text: '  ' } })
  const missingQuestion = await api.ask({ ...askBase, question: '' })
  assert.equal(missingQuote.kind, 'failed')
  assert.equal(missingQuestion.kind, 'failed')
  assert.equal(calls.length, 0)
})

test('N0 projector unavailable fails closed and does not search Zhihu', async () => {
  const { api, searches, calls } = orchestrator({ network: createUnavailableAuthorNetworkProjector() })
  const result = await api.search({ query: '线性代数' })
  assert.equal(result.kind, 'failed')
  assert.equal(result.code, 'NETWORK_UNAVAILABLE')
  assert.equal(searches.length, 0)
  assert.equal(calls.length, 0)
})

test('N0 projector available but empty continues to N1/N-S/N2', async () => {
  const { api, calls, searches, network } = orchestrator()
  const result = await api.search({ query: '线性映射保持加法' })
  assert.equal(result.kind, 'results')
  assert.equal(result.authors.length, 2)
  assert.equal(result.authors.every((item) => item.origin === 'zhihu'), true)
  assert.equal(calls.some((item) => item.agentId === 'N1'), true)
  assert.equal(calls.some((item) => item.agentId === 'N2'), true)
  assert.equal(searches.length, 2)
  const n2 = calls.find((item) => item.agentId === 'N2')
  assert.equal(n2.context.remainingSlots, 3)
  assert.deepEqual(n2.context.excludedAuthorIds, [])
  assert.equal(network.list().every((item) => item.weight === 'low'), true)
  assert.equal(network.list().length, 2)
})

test('N0 high-weight then low-weight then Zhihu fill remaining slots', async () => {
  const network = createInMemoryAuthorNetworkProjector()
  network.writeHigh({
    authorId: evidenceA.authorId,
    authorName: evidenceA.authorName,
    carrierId: 'carrier-foundation',
    carrierTitle: '数学基础',
    conceptId: 'n-linear-map',
    conceptTitle: '线性映射',
    normalizedQuestion: '线性映射为什么必须同时保持加法？',
  })
  network.writeLow({
    authorId: evidenceB.authorId,
    authorName: evidenceB.authorName,
    question: '线性映射数乘',
  })
  const { api, calls } = orchestrator({
    network,
    searchItems: [evidenceC],
  })
  const result = await api.search({ query: '线性映射加法' })
  assert.equal(result.kind, 'results')
  assert.equal(result.authors.length, 3)
  assert.equal(result.authors[0].origin, 'high-weight')
  assert.equal(result.authors[0].authorId, evidenceA.authorId)
  assert.equal(result.authors[1].origin, 'low-weight')
  assert.equal(result.authors[2].origin, 'zhihu')
  assert.equal(result.authors[2].authorId, evidenceC.authorId)
  const n2 = calls.find((item) => item.agentId === 'N2')
  assert.equal(n2.context.remainingSlots, 1)
  assert.ok(n2.context.excludedAuthorIds.includes(evidenceA.authorId))
  assert.ok(n2.context.excludedAuthorIds.includes(evidenceB.authorId))
  assert.equal(n2.context.candidates.some((item) => item.authorId === evidenceA.authorId), false)
})

test('Zhihu candidates fewer than remaining slots are all returned without fiction', async () => {
  const { api } = orchestrator({ searchItems: [evidenceA] })
  const result = await api.search({ query: '线性映射加法' })
  assert.equal(result.kind, 'results')
  assert.equal(result.authors.length, 1)
  assert.equal(result.authors[0].authorId, evidenceA.authorId)
  assert.equal(result.authors.some((item) => item.authorName === '刘看山'), false)
})

test('empty Zhihu after empty network is a legal empty result', async () => {
  const { api, calls } = orchestrator({ searchEmpty: true })
  const result = await api.search({ query: '线性映射加法' })
  assert.equal(result.kind, 'empty')
  assert.equal(calls.some((item) => item.agentId === 'N2'), false)
})

test('A-S keeps article Url without a homepage and does not merge same display names', async () => {
  const articleA = {
    evidenceId: 'ev-article-a',
    authorId: null,
    authorName: '同名作者',
    title: '积分梯度',
    summary: '梯度是积分核的对偶。',
    url: 'https://zhuanlan.zhihu.com/p/1',
  }
  const articleB = {
    evidenceId: 'ev-article-b',
    authorId: null,
    authorName: '同名作者',
    title: '另一篇',
    summary: '另一条文章总结。',
    url: 'https://zhuanlan.zhihu.com/p/2',
  }
  const grouped = groupAuthorCandidates([{
    queryId: 'ask-query-1',
    query: '积分梯度是什么',
    results: [articleA, articleB],
  }])
  assert.equal(grouped.length, 2)
  assert.equal(grouped[0].authorId, 'author-ev-ev-article-a')
  assert.equal(grouped[1].authorId, 'author-ev-ev-article-b')
  assert.equal(grouped[0].evidence[0].url, articleA.url)

  const { api, calls } = orchestrator({ searchItems: [articleA] })
  const result = await api.ask(askBase)
  assert.equal(result.kind, 'authors')
  assert.equal(result.authors[0].evidenceUrl, articleA.url)
  assert.match(result.authors[0].displayText, /详细内容可以阅读我的文章 https:\/\/zhuanlan\.zhihu\.com\/p\/1/)
  const a2 = calls.find((item) => item.agentId === 'A2')
  assert.equal(a2.options.parseInput.candidates[0].authorId, 'author-ev-ev-article-a')
  assert.equal(a2.options.parseInput.candidates[0].evidence[0].url, articleA.url)
})

test('Liu Kanshan is never stored as an enrolled author', async () => {
  const { api, network } = orchestrator({ a2: 'none' })
  await api.ask(askBase)
  assert.equal(network.list().length, 0)
  assert.equal(network.list().some((item) => item.authorName === '刘看山'), false)
})
