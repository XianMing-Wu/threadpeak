import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveOauthConfig, ZHIHU_OAUTH_AUTHORIZE_URL, ZHIHU_OAUTH_TOKEN_URL } from './oauth-config.ts'
import { createOauthService, OAUTH_STATE_COOKIE, serializeCookie } from './oauth.ts'

const env = {
  ZHIHU_OAUTH_APP_ID: 'app-id-fixture',
  ZHIHU_OAUTH_APP_KEY: 'app-key-fixture',
  ZHIHU_OAUTH_REDIRECT_URI: 'http://127.0.0.1:4301/api/auth/zhihu/callback',
}

function service(http) {
  return createOauthService({
    oauth: resolveOauthConfig(env),
    http,
    clock: { now: () => new Date('2030-01-01T00:00:00Z'), unixSeconds: () => 1_893_456_000 },
    randomState: () => 'state-fixture',
  })
}

test('missing OAuth app credentials is unavailable, not a local login success', () => {
  const resolved = resolveOauthConfig({})
  assert.equal(resolved.ok, false)
  const oauth = createOauthService({
    oauth: resolved,
    http: async () => {
      throw new Error('oauth http must not run')
    },
    clock: { now: () => new Date(), unixSeconds: () => 0 },
  })
  const started = oauth.start()
  assert.equal(started.kind, 'unavailable')
  assert.match(started.message, /请稍后再试/)
})

test('start URL follows official openapi.zhihu.com authorization-code flow', () => {
  const started = service(async () => {
    throw new Error('start must not exchange a token')
  }).start()
  assert.equal(started.kind, 'redirect')
  const url = new URL(started.authorizeUrl)
  assert.equal(`${url.origin}${url.pathname}`, ZHIHU_OAUTH_AUTHORIZE_URL)
  assert.equal(url.searchParams.get('response_type'), 'code')
  assert.equal(url.searchParams.get('app_id'), 'app-id-fixture')
  assert.equal(url.searchParams.get('redirect_uri'), env.ZHIHU_OAUTH_REDIRECT_URI)
  assert.equal(url.searchParams.get('state'), 'state-fixture')
  assert.equal(url.searchParams.has('app_key'), false)
})

test('callback exchanges authorization_code on the server and never returns app_key or access_token', async () => {
  const posts = []
  const oauth = service(async (url, init) => {
    posts.push({ url, body: init?.body, headers: init?.headers })
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ access_token: 'tok-live', token_type: 'Bearer', expires_in: 3600 }),
    }
  })
  const started = oauth.start()
  const result = await oauth.callback({
    authorizationCode: 'auth-code-1',
    state: 'state-fixture',
    cookieHeader: serializeCookie(OAUTH_STATE_COOKIE, started.state, 600),
  })
  assert.equal(result.kind, 'authenticated')
  assert.equal(result.session.provider, 'zhihu')
  assert.equal('accessToken' in result.session, false)
  assert.equal(JSON.stringify(result).includes('app-key-fixture'), false)
  assert.equal(JSON.stringify(result).includes('tok-live'), false)
  assert.equal(posts[0].url, ZHIHU_OAUTH_TOKEN_URL)
  assert.match(posts[0].body, /grant_type=authorization_code/)
  assert.match(posts[0].body, /code=auth-code-1/)
  assert.match(posts[0].body, /app_id=app-id-fixture/)
  assert.match(posts[0].headers['Content-Type'], /application\/x-www-form-urlencoded/)
})

test('callback without matching state does not invent a session', async () => {
  const oauth = service(async () => {
    throw new Error('token exchange must not run')
  })
  const failed = await oauth.callback({
    authorizationCode: 'auth-code-1',
    state: 'wrong',
    cookieHeader: serializeCookie(OAUTH_STATE_COOKIE, 'state-fixture', 600),
  })
  assert.equal(failed.kind, 'failed')
  assert.equal(oauth.sessionFromCookie('tp_session=nope').kind, 'anonymous')
})
