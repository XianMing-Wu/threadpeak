import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { resolveProviderConfig } from '../config.ts'
import { createAgentLlmProvider } from '../agent-runtime/llm-provider.ts'
import { createAgentZhihuProvider } from '../agent-runtime/zhihu-provider.ts'
import { invokeStructuredAgent, invokeTextAgent } from '../agent-runtime/invoke.ts'
import { createLlmSummarizer } from '../agent-runtime/summarizer.ts'
import { createFollowUpOrchestrator } from './orchestrator.ts'

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
const api = createFollowUpOrchestrator({
  invokeStructured: (agentId, context, options) => invokeStructuredAgent(agentPorts, agentId, context, options),
  invokeText: (agentId, context, options) => invokeTextAgent(agentPorts, agentId, context, options),
})

test('live G1/G2 return a reply and only grow when both succeed', { timeout: 180_000 }, async () => {
  const result = await api.ask({
    routeId: `lp-follow-${Date.now()}`,
    conceptId: 'n-linear-map',
    conversationId: 'c-live',
    question: '请举一个同时保持加法和数乘的具体例子，不要写成学习路线。',
    hostNodeId: 'root',
    quote: {
      nodeId: 'root',
      text: '线性映射要同时保持向量加法和标量数乘，这样才能用矩阵表示。',
      messageId: 'm-root',
    },
    neighborhood: {
      host: {
        nodeId: 'root',
        title: '线性映射',
        content: '线性映射要同时保持向量加法和标量数乘，这样才能用矩阵表示。',
        annotations: [],
      },
      siblings: [],
      predecessors: [],
      successors: [],
      edges: [],
    },
    messages: [{
      messageId: 'm-root',
      role: 'assistant',
      content: '线性映射要同时保持向量加法和标量数乘，这样才能用矩阵表示。',
      annotations: [],
    }],
  })
  assert.equal(result.kind, 'completed', result.kind === 'failed' ? result.message : '')
  assert.ok(result.text.length > 20)
  assert.doesNotMatch(result.text, /Bearer |sk-/)
  if (result.grow) {
    assert.match(result.grow.relation, /predecessor|successor|parallel/)
    assert.ok(result.grow.title.trim())
    assert.ok(result.grow.edgeExplanation.trim())
  }
})
