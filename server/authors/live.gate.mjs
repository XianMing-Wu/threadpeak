import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { resolveProviderConfig } from '../config.ts'
import { createAgentLlmProvider } from '../agent-runtime/llm-provider.ts'
import { createAgentZhihuProvider } from '../agent-runtime/zhihu-provider.ts'
import { invokeStructuredAgent, invokeTextAgent } from '../agent-runtime/invoke.ts'
import { createLlmSummarizer } from '../agent-runtime/summarizer.ts'
import { createAuthorsOrchestrator } from './orchestrator.ts'
import { createInMemoryAuthorNetworkProjector } from './network.ts'

function loadDotEnv(filePath) {
  const env = { ...process.env }
  try {
    for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const splitAt = trimmed.indexOf('=')
      if (splitAt <= 0) continue
      const key = trimmed.slice(0, splitAt).trim()
      const value = trimmed.slice(splitAt + 1).trim()
      if (!(key in env) || env[key] === '') env[key] = value
    }
  } catch {
    // composition still reads process.env
  }
  return env
}

const http = async (url, init) => {
  const timeout = AbortSignal.timeout(90_000)
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout
  const response = await fetch(url, {
    method: init?.method ?? 'GET',
    headers: init?.headers,
    body: init?.body,
    signal,
  })
  return { ok: response.ok, status: response.status, text: () => response.text(), body: response.body }
}

const clock = { now: () => new Date(), unixSeconds: () => Math.floor(Date.now() / 1000) }
const resolved = resolveProviderConfig(loadDotEnv(resolve(process.cwd(), '.env')))
if (!resolved.ok) throw new Error(`live gate requires real Zhihu and DeepSeek config, missing ${resolved.missing.join(',')}`)

const llm = createAgentLlmProvider({ config: resolved.config, http })
const zhihu = createAgentZhihuProvider({ config: resolved.config, http, clock })
const summarizer = createLlmSummarizer({ llm })
const agentPorts = { llm, zhihu, summarizer }
const network = createInMemoryAuthorNetworkProjector()
const api = createAuthorsOrchestrator({
  invokeStructured: (agentId, context, options) => invokeStructuredAgent(agentPorts, agentId, context, options),
  invokeText: (agentId, context, options) => invokeTextAgent(agentPorts, agentId, context, options),
  search: (query, count) => zhihu.search(query, count),
  network,
})

test('live A1–A3 ask-authors returns real authors or Liu Kanshan without writing Liu to the network', { timeout: 180_000 }, async () => {
  const result = await api.ask({
    question: '这段为什么强调必须同时保持加法和数乘？请指出常见误区。',
    selection: {
      text: '线性映射要同时保持向量加法和标量数乘，这样才能用矩阵表示。',
      anchor: 'root',
    },
    host: {
      nodeId: 'root',
      content: '线性映射要同时保持向量加法和标量数乘，这样才能用矩阵表示。只保持其中一个就不是线性映射。',
    },
    carrier: { id: 'carrier-foundation', title: '数学基础' },
    concept: { id: 'n-linear-map', title: '线性映射' },
  })
  assert.notEqual(result.kind, 'failed', result.kind === 'failed' ? result.message : '')
  if (result.kind === 'authors') {
    assert.ok(result.authors.length >= 1 && result.authors.length <= 2)
    for (const author of result.authors) {
      assert.notEqual(author.authorName, '刘看山')
      assert.match(author.evidenceUrl, /^https:\/\/([a-z0-9-]+\.)?zhihu\.com\//)
      assert.match(author.displayText, /详细内容可以阅读我的文章/)
      assert.equal(author.displayText.includes(author.evidenceUrl), true)
    }
    assert.equal(network.list().every((item) => item.weight === 'high'), true)
    assert.equal(network.list().some((item) => item.authorName === '刘看山'), false)
  } else {
    assert.ok(result.text.length > 10)
    assert.doesNotMatch(result.text, /Bearer |sk-/)
    assert.equal(network.list().length, 0)
  }
})

test('live N0 empty network then N1/N-S/N2 returns at most 3 real people', { timeout: 180_000 }, async () => {
  const result = await api.search({ query: '线性映射 可加性 数乘 知乎讲解' })
  assert.notEqual(result.kind, 'failed', result.kind === 'failed' ? result.message : '')
  if (result.kind === 'empty') return
  assert.ok(result.authors.length >= 1 && result.authors.length <= 3)
  const ids = result.authors.map((item) => item.authorId)
  assert.equal(new Set(ids).size, ids.length)
  assert.equal(result.authors.some((item) => item.authorName === '刘看山'), false)
  for (const author of result.authors.filter((item) => item.origin === 'zhihu')) {
    assert.equal(network.list().some((item) => item.authorId === author.authorId && item.weight === 'low'), true)
  }
})
