import assert from 'node:assert/strict'
import test from 'node:test'
import { createDeepSeekAnswerAdapter } from './deepseek.adapter.ts'

const config = {
  zhihuAccessSecret: 'secret',
  zhihuApiBaseUrl: 'https://developer.zhihu.com',
  deepseekApiKey: 'key',
  deepseekBaseUrl: 'https://api.deepseek.com',
  deepseekModelName: 'deepseek-v4-flash',
}

test('ordinary DeepSeek calls disable v4 thinking so answers are not empty timeouts', async () => {
  const bodies = []
  const http = async (_url, init) => {
    bodies.push(JSON.parse(String(init?.body ?? '{}')))
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ choices: [{ message: { content: '线性映射保持加法。' } }] }),
    }
  }
  const adapter = createDeepSeekAnswerAdapter({ config, http })
  const answered = await adapter.answer({ question: '什么是线性映射？', evidence: [] })
  assert.equal(answered.kind, 'completed')
  assert.deepEqual(bodies[0]?.thinking, { type: 'disabled' })
  assert.equal(bodies[0]?.stream, undefined)
})

test('streamed completions also disable thinking and read content deltas', async () => {
  const bodies = []
  const encoder = new TextEncoder()
  const http = async (_url, init) => {
    bodies.push(JSON.parse(String(init?.body ?? '{}')))
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"缩放"}}]}\n\n'))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })
    return { ok: true, status: 200, text: async () => '', body: stream }
  }
  const adapter = createDeepSeekAnswerAdapter({ config, http })
  const chunks = []
  for await (const event of adapter.answerStream({ question: '缩放比例？', evidence: [] })) chunks.push(event)
  assert.deepEqual(bodies[0]?.thinking, { type: 'disabled' })
  assert.equal(bodies[0]?.stream, true)
  assert.equal(chunks.at(-1)?.kind, 'completed')
  assert.equal(chunks.at(-1)?.text, '缩放')
})
