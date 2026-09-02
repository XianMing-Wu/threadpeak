export const ZHIHU_OAUTH_ENV_KEYS = [
  'ZHIHU_OAUTH_APP_ID',
  'ZHIHU_OAUTH_APP_KEY',
  'ZHIHU_OAUTH_REDIRECT_URI',
] as const

export type ZhihuOauthEnvKey = (typeof ZHIHU_OAUTH_ENV_KEYS)[number]

export type ZhihuOauthConfig = {
  appId: string
  appKey: string
  redirectUri: string
  successRedirect: string
}

export type OauthConfigResolution =
  | { ok: true; config: ZhihuOauthConfig }
  | { ok: false; code: 'OAUTH_UNAVAILABLE'; missing: readonly ZhihuOauthEnvKey[] }

const MAX_URL_LENGTH = 300
const MAX_ID_LENGTH = 200
const MAX_KEY_LENGTH = 4096

const AUTHORIZE_ORIGIN = 'https://openapi.zhihu.com'
const TOKEN_PATH = '/access_token'

export const ZHIHU_OAUTH_AUTHORIZE_URL = `${AUTHORIZE_ORIGIN}/authorize`
export const ZHIHU_OAUTH_TOKEN_URL = `${AUTHORIZE_ORIGIN}${TOKEN_PATH}`
export const ZHIHU_OAUTH_ORIGIN = AUTHORIZE_ORIGIN

function readTrimmed(env: Record<string, string | undefined>, key: ZhihuOauthEnvKey): string {
  return env[key]?.trim() ?? ''
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (url.protocol === 'https:' || url.protocol === 'http:')
      && !url.username
      && !url.password
      && value.length <= MAX_URL_LENGTH
  } catch {
    return false
  }
}

export function resolveOauthConfig(env: Record<string, string | undefined>): OauthConfigResolution {
  const missing = ZHIHU_OAUTH_ENV_KEYS.filter((key) => !readTrimmed(env, key))
  if (missing.length > 0) return { ok: false, code: 'OAUTH_UNAVAILABLE', missing }

  const appId = readTrimmed(env, 'ZHIHU_OAUTH_APP_ID')
  const appKey = readTrimmed(env, 'ZHIHU_OAUTH_APP_KEY')
  const redirectUri = readTrimmed(env, 'ZHIHU_OAUTH_REDIRECT_URI')
  if (appId.length > MAX_ID_LENGTH || appKey.length > MAX_KEY_LENGTH) {
    return { ok: false, code: 'OAUTH_UNAVAILABLE', missing: ['ZHIHU_OAUTH_APP_ID', 'ZHIHU_OAUTH_APP_KEY'] }
  }
  if (!isHttpUrl(redirectUri)) {
    return { ok: false, code: 'OAUTH_UNAVAILABLE', missing: ['ZHIHU_OAUTH_REDIRECT_URI'] }
  }

  const successRedirect = env.ZHIHU_OAUTH_SUCCESS_REDIRECT?.trim()
  return {
    ok: true,
    config: {
      appId,
      appKey,
      redirectUri,
      successRedirect: successRedirect && isHttpUrl(successRedirect) ? successRedirect : 'http://127.0.0.1:4301/#home',
    },
  }
}

export function oauthTokenAllowed(url: string): boolean {
  try {
    return new URL(url).origin === ZHIHU_OAUTH_ORIGIN
  } catch {
    return false
  }
}
