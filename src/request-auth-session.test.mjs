import assert from 'node:assert/strict'
import test from 'node:test'
import { requestAuthSession, requestAuthStart } from './runtime/request-auth-session.ts'

test('auth start does not invent a Zhihu authorize URL when the server is unavailable', async () => {
  const result = await requestAuthStart(async () => {
    throw new Error('offline')
  })
  assert.equal(result.kind, 'unavailable')
  assert.match(result.message, /不能把本地开关或延时动画当成知乎账号授权成功/)
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
