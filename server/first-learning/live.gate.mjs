import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { resolveProviderConfig } from '../config.ts'
import { createAgentLlmProvider } from '../agent-runtime/llm-provider.ts'
import { createAgentZhihuProvider } from '../agent-runtime/zhihu-provider.ts'
import { invokeStructuredAgent, invokeTextAgent } from '../agent-runtime/invoke.ts'
import { createLlmSummarizer } from '../agent-runtime/summarizer.ts'
import { createFirstLearningOrchestrator } from './orchestrator.ts'

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
const api = createFirstLearningOrchestrator({
  invokeStructured: (agentId, context, options) => invokeStructuredAgent(agentPorts, agentId, context, options),
  invokeText: (agentId, context, options) => invokeTextAgent(agentPorts, agentId, context, options),
})

test('live L0a/L0b settle first answer and unique root together, then reuse', { timeout: 180_000 }, async () => {
  const input = {
    routeId: `lp-live-${Date.now()}`,
    conceptId: 'n-linear-map',
    title: '线性映射',
    hasDispute: true,
    detailedDescription: '讲解应偏向：它为什么要同时保持加法和数乘，以及它要解决什么表示问题。不要带附件原件。',
    attachmentSourceIds: [],
  }
  const first = await api.enter(input)
  assert.equal(first.kind, 'completed', first.kind === 'failed' ? first.message : '')
  assert.equal(first.reused, false)
  assert.ok(first.answer.text.length > 20)
  assert.doesNotMatch(first.answer.text, /三路|整理过程|directAnswers/)
  assert.equal(first.graph.root.title, '线性映射')
  assert.equal(first.graph.root.nodeId, 'root')
  assert.equal(first.graph.canonicalContentHash, first.answer.contentHash)
  assert.equal(api.get(input.routeId, input.conceptId)?.graph.graphId, first.graph.graphId)

  const second = await api.enter(input)
  assert.equal(second.kind, 'completed')
  assert.equal(second.reused, true)
  assert.equal(second.answer.contentHash, first.answer.contentHash)
  assert.equal(second.graph.graphId, first.graph.graphId)
  assert.equal(second.answer.text, first.answer.text)
})
