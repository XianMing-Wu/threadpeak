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

test('HTTP 200 business errors keep their real code, retry policy and Retry-After',async()=>{
  for(const [upstream,code,retryable] of [['30001','ZHIHU_RATE_LIMITED',true],['90001','ZHIHU_CODE_90001',true],['20001','AUTH_INVALID',false]]){
    const provider=createAgentZhihuProvider({config,clock:{unixSeconds:()=>1},http:async()=>({ok:true,status:200,headers:new Headers({'Retry-After':'12'}),text:async()=>JSON.stringify({Code:upstream,Message:'upstream failure'})})})
    for(const result of [await provider.direct({messages:[],thinkingDepth:'fast'}),await provider.search('概念',10)]){
      assert.equal(result.kind,'failed');assert.equal(result.code,code);assert.equal(result.retryable,retryable)
      assert.equal(result.diagnostic.httpStatus,200);assert.equal(result.diagnostic.upstreamCode,upstream);assert.equal(result.diagnostic.retryAfter,'12')
    }
  }
})

test('malformed, empty and incomplete direct responses are distinct failures with HTTP diagnostics',async()=>{
  for(const [body,code] of [['not-json','ZHIHU_INVALID_JSON'],['{}','ZHIHU_EMPTY_RESPONSE'],[JSON.stringify({choices:[{message:{content:'未完整结束'},finish_reason:'length'}]}),'ZHIHU_INCOMPLETE_RESPONSE']]){
    const provider=createAgentZhihuProvider({config,clock:{unixSeconds:()=>1},http:async()=>({ok:true,status:200,headers:new Headers({'x-request-id':'test-id'}),text:async()=>body})})
    const result=await provider.direct({messages:[],thinkingDepth:'fast'})
    assert.equal(result.code,code);assert.equal(result.diagnostic.httpStatus,200);assert.equal(result.diagnostic.requestId,'test-id');assert.notEqual(result.cacheable,true)
  }
})

test('transport timeout, connection reset and user cancellation do not collapse to an unknown service error',async()=>{
  for(const [cause,signal,code,retryable] of [[new DOMException('private detail','TimeoutError'),undefined,'ZHIHU_TIMEOUT',true],[Object.assign(new TypeError('fetch failed'),{cause:{code:'ECONNRESET'}}),undefined,'ZHIHU_NETWORK_UNAVAILABLE',true],[new DOMException('private detail','AbortError'),AbortSignal.abort(),'CANCELLED',false]]){
    const provider=createAgentZhihuProvider({config,clock:{unixSeconds:()=>1},http:async()=>{throw cause}})
    for(const result of [await provider.direct({messages:[],thinkingDepth:'fast',signal}),await provider.search('概念',10,signal)]){
      assert.equal(result.code,code);assert.equal(result.retryable,retryable);assert.equal(result.diagnostic.httpStatus,undefined)
      assert.ok(!JSON.stringify(result).includes('private detail'));assert.ok(!JSON.stringify(result).includes('secret'))
    }
  }
})

test('zhihu direct reports retryable 429 to the durable worker without hidden retries', { timeout: 8_000 }, async () => {
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
  assert.equal(result.kind, 'failed')
  assert.equal(result.code, 'ZHIHU_RATE_LIMITED')
  assert.equal(result.retryable, true)
  assert.equal(calls, 1)
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
