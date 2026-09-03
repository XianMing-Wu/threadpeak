import assert from 'node:assert/strict'
import test from 'node:test'
import { createAgentZhihuProvider, resolveSearchAuthorId, stableEvidenceId } from './zhihu-provider.ts'

const config = {
  zhihuAccessSecret: 'secret',
  zhihuApiBaseUrl: 'https://developer.zhihu.com/api/v1',
  deepseekApiKey: 'key',
  deepseekBaseUrl: 'https://api.deepseek.com',
  deepseekModelName: 'deepseek-chat',
}

test('zhihu direct retries HTTP 429 then succeeds', { timeout: 8_000 }, async () => {
  let calls = 0
  const zhihu = createAgentZhihuProvider({
    config,
    clock: { now: () => new Date(), unixSeconds: () => 1 },
    async http() {
      calls += 1
      if (calls < 2) {
        return { ok: false, status: 429, text: async () => JSON.stringify({ error: { message: 'rate limit exceeded' } }) }
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ choices: [{ message: { content: '具体讲解正文' } }] }),
      }
    },
  })
  const result = await zhihu.direct({
    messages: [{ role: 'user', content: '线性映射' }],
    thinkingDepth: 'fast',
  })
  assert.equal(result.kind, 'completed')
  assert.equal(result.text, '具体讲解正文')
  assert.equal(calls, 2)
})

test('search maps official article Url and binds authorId per evidence when homepage is absent', async () => {
  const article = 'https://zhuanlan.zhihu.com/p/1'
  const zhihu = createAgentZhihuProvider({
    config,
    clock: { now: () => new Date(), unixSeconds: () => 1 },
    async http() {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          Code: 0,
          Data: {
            Items: [{
              Title: '积分梯度是什么',
              Url: article,
              ContentText: '梯度是积分核的对偶。',
              AuthorName: '真实作者',
            }],
          },
        }),
      }
    },
  })
  const result = await zhihu.search('积分梯度是什么', 8)
  assert.equal(result.kind, 'hits')
  assert.equal(result.items[0].url, article)
  assert.equal(result.items[0].authorName, '真实作者')
  assert.equal(result.items[0].authorId, resolveSearchAuthorId(null, stableEvidenceId(article)))
  assert.match(result.items[0].authorId, /^author-ev-/)
})
