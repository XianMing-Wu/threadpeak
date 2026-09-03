import assert from 'node:assert/strict'
import test from 'node:test'
import { createAgentLlmProvider } from './llm-provider.ts'
import { invokeStructuredAgent, invokeTextAgent } from './invoke.ts'
import { SHARED_SYSTEM_PREFIX } from './constants.ts'
import {
  PUBLIC_STRUCTURE_FAILURE_MESSAGE,
  STRUCTURE_REPAIR_USER_PREFIX,
  STRUCTURE_SELF_REPAIR_LIMIT,
} from './repair.ts'

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

test('extra keys are extracted and do not trigger a repair call', async () => {
  const bodies = []
  const llm = createAgentLlmProvider({
    config,
    http: async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body ?? '{}')))
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ ...r1Json, extra: true }) } }],
        }),
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
  assert.equal(bodies.length, 1)
  assert.doesNotMatch(JSON.stringify(result), /extra/)
})

test('missing required fields trigger one same-Agent repair', async () => {
  const bodies = []
  const llm = createAgentLlmProvider({
    config,
    http: async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body ?? '{}')))
      const content = bodies.length === 1
        ? JSON.stringify({ queries: r1Json.queries.slice(0, 2) })
        : JSON.stringify(r1Json)
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ choices: [{ message: { content } }] }),
      }
    },
  })
  const zhihu = {
    async search() { return { kind: 'empty' } },
    async direct() { return { kind: 'failed', message: 'unused' } },
  }
  const result = await invokeStructuredAgent({ llm, zhihu }, 'R1', { goal: '线性映射', attachments: [] })
  assert.equal(result.kind, 'completed')
  assert.equal(bodies.length, 2)
  assert.equal(bodies[1].messages.at(-1).content.startsWith(STRUCTURE_REPAIR_USER_PREFIX), true)
})

test('always-invalid structure fails closed with a user-safe message', async () => {
  let calls = 0
  const llm = createAgentLlmProvider({
    config,
    http: async () => {
      calls += 1
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ queries: r1Json.queries.slice(0, 2) }) } }],
        }),
      }
    },
  })
  const zhihu = {
    async search() { return { kind: 'empty' } },
    async direct() { return { kind: 'failed', message: 'unused' } },
  }
  const result = await invokeStructuredAgent({ llm, zhihu }, 'R1', { goal: '线性映射', attachments: [] })
  assert.equal(result.kind, 'failed')
  assert.equal(result.code, 'OUTPUT_INVALID')
  assert.equal(result.message, PUBLIC_STRUCTURE_FAILURE_MESSAGE)
  assert.doesNotMatch(result.message, /Agent|指定结构|schema/i)
  assert.equal(calls, STRUCTURE_SELF_REPAIR_LIMIT + 1)
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

test('provider failure stays explicit and does not enter structure self-repair', async () => {
  let calls = 0
  const llm = createAgentLlmProvider({
    config,
    http: async () => {
      calls += 1
      return { ok: false, status: 503, text: async () => 'nope' }
    },
  })
  const zhihu = {
    async search() { return { kind: 'empty' } },
    async direct() { return { kind: 'failed', message: 'unused' } },
  }
  const result = await invokeStructuredAgent({ llm, zhihu }, 'R1', { goal: '线性映射', attachments: [] })
  assert.equal(result.kind, 'failed')
  assert.equal(result.code, 'PROVIDER_UNAVAILABLE')
  assert.doesNotMatch(result.message, /nope|Bearer|key/i)
  assert.equal(calls, 1)
})
