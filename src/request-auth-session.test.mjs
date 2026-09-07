import assert from 'node:assert/strict'
import test from 'node:test'
import { requestAuthSession, requestAuthStart, isZhihuAuthorizeUrl } from './runtime/request-auth-session.ts'

test('auth start does not invent a Zhihu authorize URL when the server is unavailable', async () => {
  const result = await requestAuthStart(async () => {
    throw new Error('offline')
  })
  assert.equal(result.kind, 'unavailable')
  assert.match(result.message, /请稍后再试/)
})

test('auth start accepts the official openapi.zhihu.com authorize URL', async () => {
  const authorizeUrl = 'https://openapi.zhihu.com/authorize?app_id=x&redirect_uri=http://127.0.0.1:4301/api/auth/zhihu/callback&response_type=code&state=s'
  const result = await requestAuthStart(async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ kind: 'redirect', authorizeUrl }),
  }))
  assert.equal(result.kind, 'redirect')
  if (result.kind === 'redirect') assert.equal(result.authorizeUrl, authorizeUrl)
})

test('auth start only follows official openapi.zhihu.com authorize URLs', async () => {
  const result = await requestAuthStart(async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({
      kind: 'redirect',
      authorizeUrl: 'https://evil.example/authorize',
    }),
  }))
  assert.equal(result.kind, 'unavailable')
})

test('auth session does not treat a named profile payload as signed-in identity', async () => {
  const result = await requestAuthSession(async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ kind: 'authenticated', provider: 'zhihu', name: '吴贤明' }),
  }))
  assert.equal(result.kind, 'authenticated')
  assert.equal('name' in result, false)
})


test('demo authorization redirects only to the current loopback callback, real URLs remain restricted', () => {
  const origin='http://localhost:4305',url=origin+'/api/auth/zhihu/callback?authorization_code=tp-demo.test&state=state'
  assert.equal(isZhihuAuthorizeUrl(url,'mock',origin),true)
  assert.equal(isZhihuAuthorizeUrl(url,'real',origin),false)
  assert.equal(isZhihuAuthorizeUrl(url,'mock','http://localhost:4304'),false)
  assert.equal(isZhihuAuthorizeUrl('https://evil.test/api/auth/zhihu/callback?authorization_code=tp-demo.test','mock',origin),false)
  assert.equal(isZhihuAuthorizeUrl('https://openapi.zhihu.com/authorize?app_id=app','real',origin),true)
  assert.equal(isZhihuAuthorizeUrl('https://user@openapi.zhihu.com/authorize','real',origin),false)
})
