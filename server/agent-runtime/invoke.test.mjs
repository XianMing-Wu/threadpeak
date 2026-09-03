import assert from 'node:assert/strict'
import test from 'node:test'
import { createAgentLlmProvider } from './llm-provider.ts'
import { invokeStructuredAgent, invokeTextAgent } from './invoke.ts'
import { SHARED_SYSTEM_PREFIX } from './constants.ts'

const config = {
  zhihuAccessSecret: 'secret',
  zhihuApiBaseUrl: 'https://developer.zhihu.com',
  deepseekApiKey: 'key',
  deepseekBaseUrl: 'https://api.deepseek.com',
  deepseekModelName: 'deepseek-v4-flash',
}

const r1Json = {
  queries: [
    { id: 'q1', text: '线性映射怎么学', angle: 'normal_learning' },
    { id: 'q2', text: '线性映射入门路径', angle: 'normal_learning' },
    { id: 'q3', text: '线性映射常见坑', angle: 'pitfall_or_dispute' },
    { id: 'q4', text: '线性映射容易误导的学法', angle: 'pitfall_or_dispute' },
  ],
}

test('structured invoke validates JSON and uses fast thinking by default', async () => {
  const bodies = []
  const llm = createAgentLlmProvider({
    config,
    http: async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body ?? '{}')))
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify(r1Json) } }] }),
      }
    },
  })
  const zhihu = {
    async search() { return { kind: 'empty' } },
    async direct() { return { kind: 'failed', message: 'unused' } },
  }
  const result = await invokeStructuredAgent({ llm, zhihu }, 'R1', { goal: '线性映射', attachments: [] })
  assert.equal(result.kind, 'completed')
  assert.equal(result.value.queries.length, 4)
  assert.deepEqual(bodies[0].thinking, { type: 'disabled' })
  assert.equal(bodies[0].response_format.type, 'json_object')
  assert.equal(bodies[0].messages[0].content.startsWith(SHARED_SYSTEM_PREFIX), true)
})

test('invalid extra fields are agent failures, not repaired success', async () => {
  const llm = createAgentLlmProvider({
    config,
    http: async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ ...r1Json, extra: true }) } }],
      }),
    }),
  })
  const zhihu = {
    async search() { return { kind: 'empty' } },
    async direct() { return { kind: 'failed', message: 'unused' } },
  }
  const result = await invokeStructuredAgent({ llm, zhihu }, 'R1', { goal: '线性映射', attachments: [] })
  assert.equal(result.kind, 'failed')
  assert.equal(result.code, 'OUTPUT_INVALID')
})

test('deep thinking is forwarded to the LLM request body', async () => {
  const bodies = []
  const llm = createAgentLlmProvider({
    config,
    http: async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body ?? '{}')))
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ choices: [{ message: { content: '正文' } }] }),
      }
    },
  })
  const zhihu = {
    async search() { return { kind: 'empty' } },
    async direct() { return { kind: 'failed', message: 'unused' } },
  }
  const result = await invokeTextAgent({ llm, zhihu }, 'R5', {
    conversation: [{ messageId: 'm1', role: 'user', kind: 'text', content: '已发布后继续问' }],
    currentMessage: '矩阵和映射什么关系？',
    attachments: [],
  }, { thinkingDepth: 'deep' })
  assert.equal(result.kind, 'completed')
  assert.deepEqual(bodies[0].thinking, { type: 'enabled' })
})

test('JSON agents do not treat reasoning_content as structured output', async () => {
  const llm = createAgentLlmProvider({
    config,
    http: async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        choices: [{ message: { content: '', reasoning_content: 'thinking out loud' } }],
      }),
    }),
  })
  const zhihu = {
    async search() { return { kind: 'empty' } },
    async direct() { return { kind: 'failed', message: 'unused' } },
  }
  const result = await invokeStructuredAgent({ llm, zhihu }, 'R1', { goal: '线性映射', attachments: [] })
  assert.equal(result.kind, 'failed')
  assert.equal(result.code, 'PROVIDER_UNAVAILABLE')
})

test('deep thinking raises max_tokens so reasoning cannot consume the whole budget', async () => {
  const bodies = []
  const llm = createAgentLlmProvider({
    config,
    http: async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body ?? '{}')))
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify(r1Json) } }] }),
      }
    },
  })
  const zhihu = {
    async search() { return { kind: 'empty' } },
    async direct() { return { kind: 'failed', message: 'unused' } },
  }
  await invokeStructuredAgent({ llm, zhihu }, 'R1', { goal: '线性映射', attachments: [] }, { thinkingDepth: 'deep' })
  assert.ok(bodies[0].max_tokens >= 8192)
  assert.deepEqual(bodies[0].thinking, { type: 'enabled' })
})

test('provider failure stays explicit and does not invent output', async () => {
  const llm = createAgentLlmProvider({
    config,
    http: async () => ({ ok: false, status: 503, text: async () => 'nope' }),
  })
  const zhihu = {
    async search() { return { kind: 'empty' } },
    async direct() { return { kind: 'failed', message: 'unused' } },
  }
  const result = await invokeStructuredAgent({ llm, zhihu }, 'R1', { goal: '线性映射', attachments: [] })
  assert.equal(result.kind, 'failed')
  assert.equal(result.code, 'PROVIDER_UNAVAILABLE')
  assert.doesNotMatch(result.message, /nope|Bearer|key/i)
})
