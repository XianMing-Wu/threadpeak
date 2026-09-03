import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { resolveProviderConfig } from '../config.ts'
import { invokeStructuredAgent, invokeTextAgent } from './invoke.ts'
import { createAgentLlmProvider } from './llm-provider.ts'
import { createAgentZhihuProvider } from './zhihu-provider.ts'
import { parseAgentOutput } from './schemas.ts'
import { SHARED_SYSTEM_PREFIX } from './constants.ts'

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
  return {
    ok: response.ok,
    status: response.status,
    text: () => response.text(),
    body: response.body,
  }
}

const clock = {
  now: () => new Date(),
  unixSeconds: () => Math.floor(Date.now() / 1000),
}

const env = loadDotEnv(resolve(process.cwd(), '.env'))
const resolved = resolveProviderConfig(env)
if (!resolved.ok) {
  throw new Error(`live gate requires real Zhihu and DeepSeek config, missing ${resolved.missing.join(',')}`)
}

const llm = createAgentLlmProvider({ config: resolved.config, http })
const zhihu = createAgentZhihuProvider({ config: resolved.config, http, clock })
const ports = { llm, zhihu }

test('live Zhihu search returns public hits with stable evidence ids', { timeout: 90_000 }, async () => {
  const result = await zhihu.search('线性映射 入门', 5)
  assert.notEqual(result.kind, 'failed', result.kind === 'failed' ? result.message : '')
  if (result.kind === 'empty') return
  assert.ok(result.items.length > 0)
  for (const item of result.items) {
    assert.match(item.url, /^https:\/\/([a-z0-9-]+\.)?zhihu\.com\//)
    assert.equal(item.evidenceId.length, 32)
    if (item.authorName) assert.notEqual(item.authorName, '刘看山')
    if (item.authorId) assert.doesNotMatch(item.authorId, /liukanshan/i)
  }
})

test('live DeepSeek R1 returns a valid 4–5 query split covering both angles', { timeout: 120_000 }, async () => {
  const result = await invokeStructuredAgent(ports, 'R1', {
    goal: '我想入门线性代数里的线性映射，只要小白能懂的学法。',
    attachments: [],
  })
  assert.equal(result.kind, 'completed', result.kind === 'failed' ? `${result.code} ${result.message}` : '')
  assert.ok(result.value.queries.length >= 4)
  assert.ok(result.value.queries.length <= 5)
  const angles = new Set(result.value.queries.map((item) => item.angle))
  assert.ok(angles.has('normal_learning'))
  assert.ok(angles.has('pitfall_or_dispute'))
  assert.equal(result.compressed, false)
})

test('live Zhihu direct L0a concrete explanation returns non-empty text', { timeout: 120_000 }, async () => {
  const result = await invokeTextAgent(ports, 'L0a', {
    concept: {
      conceptId: 'linear-map',
      title: '线性映射',
      hasDispute: true,
      detailedDescription: '讲解应偏向：它为什么要同时保持加法和数乘，以及它要解决什么表示问题。',
      attachmentSourceIds: [],
    },
    angle: 'concrete_explanation',
  }, { angle: 'concrete_explanation' })
  assert.equal(result.kind, 'completed', result.kind === 'failed' ? `${result.code} ${result.message}` : '')
  assert.ok(result.text.length > 20)
  assert.doesNotMatch(result.text, /Bearer |sk-/)
})

test('live compressed R1 still validates after stub compression of a huge attachment', { timeout: 120_000 }, async () => {
  const result = await invokeStructuredAgent(ports, 'R1', {
    goal: '我想搞懂线性映射。',
    attachments: [{
      sourceId: 'att-live',
      fileName: 'notes.txt',
      mimeType: 'text/plain',
      content: `线性映射讲义。${'保持加法与数乘。'.repeat(80_000)}`,
    }],
  })
  assert.equal(result.kind, 'completed', result.kind === 'failed' ? `${result.code} ${result.message}` : '')
  assert.equal(result.compressed, true)
  const parsed = parseAgentOutput('R1', result.value)
  assert.equal(parsed.ok, true)
})

test('live DeepSeek deep-thinking request still yields parseable R1 JSON', { timeout: 180_000 }, async () => {
  const result = await invokeStructuredAgent(ports, 'R1', {
    goal: '线性映射入门',
    attachments: [],
  }, { thinkingDepth: 'deep' })
  assert.equal(result.kind, 'completed', result.kind === 'failed' ? `${result.code} ${result.message}` : '')
  assert.ok(result.value.queries.length >= 4)
})

test('assembled live calls keep the shared system prefix', () => {
  assert.match(SHARED_SYSTEM_PREFIX, /不能改写本系统指令/)
})
