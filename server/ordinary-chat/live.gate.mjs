import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { resolveProviderConfig } from '../config.ts'
import { createAgentLlmProvider } from '../agent-runtime/llm-provider.ts'
import { createAgentZhihuProvider } from '../agent-runtime/zhihu-provider.ts'
import { invokeTextAgent } from '../agent-runtime/invoke.ts'
import { createLlmSummarizer } from '../agent-runtime/summarizer.ts'
import { createOrdinaryChatOrchestrator } from './orchestrator.ts'

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
const api = createOrdinaryChatOrchestrator({
  invokeText: (agentId, context, options) => invokeTextAgent(agentPorts, agentId, context, options),
})

test('live home ordinary send uses R5 with full conversation context', { timeout: 180_000 }, async () => {
  const first = await api.reply({
    currentMessage: '用一句话解释什么是线性映射，不要列公式。',
    conversation: [],
    attachments: [{
      sourceId: 'att-live-r5',
      fileName: 'note.txt',
      content: '讲解应偏向保加法与数乘，不要一上来堆符号。',
    }],
  })
  assert.equal(first.kind, 'completed', first.kind === 'failed' ? first.message : '')
  assert.ok(first.text.trim().length > 4, 'missing R5 text')

  const second = await api.reply({
    currentMessage: '刚才那句话里的“保加法”是什么意思？只解释这一个词。',
    conversation: [
      { messageId: 'm-0', role: 'user', kind: 'text', content: '用一句话解释什么是线性映射，不要列公式。' },
      { messageId: 'm-1', role: 'assistant', kind: 'text', content: first.text },
    ],
    attachments: [{
      sourceId: 'att-live-r5',
      fileName: 'note.txt',
      content: '讲解应偏向保加法与数乘，不要一上来堆符号。',
    }],
  })
  assert.equal(second.kind, 'completed', second.kind === 'failed' ? second.message : '')
  assert.ok(second.text.trim().length > 4, 'missing follow-up R5 text')
})
