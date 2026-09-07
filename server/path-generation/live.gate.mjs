import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { resolveProviderConfig } from '../config.ts'
import { createAgentLlmProvider } from '../agent-runtime/llm-provider.ts'
import { createAgentZhihuProvider } from '../agent-runtime/zhihu-provider.ts'
import { invokeStructuredAgent, invokeTextAgent } from '../agent-runtime/invoke.ts'
import { createLlmSummarizer } from '../agent-runtime/summarizer.ts'
import { createPathOrchestrator } from './orchestrator.ts'
import { isLearningPathRendererDocument } from '../../src/path-3d/validate-renderer-document.ts'

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
  const timeout = AbortSignal.timeout(init?.timeoutMs ?? 90_000)
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
const api = createPathOrchestrator({
  invokeStructured: (agentId, context, options) => invokeStructuredAgent(agentPorts, agentId, context, options),
  invokeText: (agentId, context, options) => invokeTextAgent(agentPorts, agentId, context, options),
  search: (query, count) => zhihu.search(query, count),
})

async function completeIfQuestions(view) {
  let current = view
  if (current.status !== 'awaiting_answers') return current
  const active = current.questionSets.find((item) => item.status === 'active')
  if (!active) return current
  for (const question of active.questions) {
    if (current.status !== 'awaiting_answers') return current
    const option = question.options[0]
    current = await api.select({ runId: current.runId, questionId: question.id, optionId: option.id })
  }
  if (current.status === 'published' || current.status === 'failed') return current
  return api.commit(current.runId)
}

test('live path run publishes a validated route without creating knowledge, then R5', { timeout: 180_000 }, async () => {
  const payload = {
    goal: '我想入门线性映射，只要小白能懂的学法。',
    attachments: [{
      sourceId: 'att-live',
      fileName: 'note.txt',
      mimeType: 'text/plain',
      content: '讲解应偏向保加法与数乘，不要一上来堆公式。',
    }],
  }
  let started = await api.start(payload)
  if (started.status === 'failed' && started.error?.code === 'OUTPUT_INVALID') {
    started = await api.start(payload)
  }
  assert.notEqual(started.status, 'failed', started.error?.message ?? '')
  const published = await completeIfQuestions(started)
  assert.equal(published.status, 'published', published.error?.message ?? '')
  assert.equal(published.knowledgeCreated, false)
  assert.equal(isLearningPathRendererDocument(published.document), true)
  assert.ok(published.route.concepts.every((item) => item.detailedDescription.length > 0))
  const replied = await api.reply({ runId: published.runId, message: '矩阵和映射有什么关系？' })
  assert.ok(replied.reply && replied.reply.length > 4, replied.error?.message ?? 'missing R5')
  const retried = await api.retry(published.runId)
  assert.equal(retried.knowledgeCreated, false)
  if (retried.status !== 'published') assert.equal(retried.document, undefined)
})
