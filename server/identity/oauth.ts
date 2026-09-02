import { randomBytes, randomUUID } from 'node:crypto'
import type { HttpPort } from '../ports.ts'
import {
  oauthTokenAllowed,
  ZHIHU_OAUTH_AUTHORIZE_URL,
  ZHIHU_OAUTH_TOKEN_URL,
  type OauthConfigResolution,
} from './oauth-config.ts'

export const OAUTH_STATE_COOKIE = 'tp_oauth_state'
export const SESSION_COOKIE = 'tp_session'
const STATE_MAX_AGE = 600
const DEFAULT_TOKEN_TTL = 3600

export type OauthSessionRecord = {
  id: string
  provider: 'zhihu'
  tokenType: string
  expiresAt: number
}

export type OauthStartResult =
  | { kind: 'unavailable'; title: string; message: string }
  | { kind: 'redirect'; authorizeUrl: string; state: string; stateMaxAge: number }

export type OauthCallbackResult =
  | { kind: 'authenticated'; session: OauthSessionRecord; sessionMaxAge: number }
  | { kind: 'failed'; title: string; message: string }

export type AuthSessionView =
  | { kind: 'anonymous' }
  | { kind: 'authenticated'; provider: 'zhihu' }

type ClockPort = { now: () => Date; unixSeconds: () => number }

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const splitAt = part.indexOf('=')
    if (splitAt <= 0) continue
    const key = part.slice(0, splitAt).trim()
    const value = part.slice(splitAt + 1).trim()
    if (key) out[key] = decodeURIComponent(value)
  }
  return out
}

export function serializeCookie(name: string, value: string, maxAge: number): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.max(0, maxAge)}`
}

export function clearCookie(name: string): string {
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}

function parseTokenPayload(payload: unknown): { accessToken: string; tokenType: string; expiresIn: number } | undefined {
  const root = asRecord(payload)
  if (!root) return undefined
  const data = asRecord(root.Data) ?? asRecord(root.data) ?? root
  const accessToken = asText(data.access_token ?? data.AccessToken)
  if (!accessToken) return undefined
  const tokenType = asText(data.token_type ?? data.TokenType) || 'Bearer'
  const expiresRaw = data.expires_in ?? data.ExpireIn ?? data.expire_in
  const expiresIn = typeof expiresRaw === 'number' && Number.isFinite(expiresRaw) ? Math.floor(expiresRaw) : DEFAULT_TOKEN_TTL
  return { accessToken, tokenType, expiresIn: Math.max(60, expiresIn) }
}

export function createOauthService(ports: {
  oauth: OauthConfigResolution
  http: HttpPort
  clock: ClockPort
  randomState?: () => string
  sessions?: Map<string, OauthSessionRecord & { accessToken: string }>
}) {
  const sessions = ports.sessions ?? new Map<string, OauthSessionRecord & { accessToken: string }>()
  const randomState = ports.randomState ?? (() => randomBytes(24).toString('hex'))

  const unavailableMessage = '登录还没有接通服务端 OAuth。不能把本地开关或延时动画当成知乎账号授权成功。'
  const unavailable = (): Extract<OauthStartResult, { kind: 'unavailable' }> => ({
    kind: 'unavailable',
    title: '无法完成知乎授权',
    message: unavailableMessage,
  })

  return {
    start(): OauthStartResult {
      if (!ports.oauth.ok) return unavailable()
      const state = randomState()
      const authorize = new URL(ZHIHU_OAUTH_AUTHORIZE_URL)
      authorize.searchParams.set('redirect_uri', ports.oauth.config.redirectUri)
      authorize.searchParams.set('app_id', ports.oauth.config.appId)
      authorize.searchParams.set('response_type', 'code')
      authorize.searchParams.set('state', state)
      return { kind: 'redirect', authorizeUrl: authorize.toString(), state, stateMaxAge: STATE_MAX_AGE }
    },

    async callback(input: {
      authorizationCode?: string
      state?: string
      cookieHeader?: string
    }): Promise<OauthCallbackResult> {
      if (!ports.oauth.ok) {
        return { kind: 'failed', title: '无法完成知乎授权', message: unavailableMessage }
      }
      const cookies = parseCookies(input.cookieHeader)
      const expectedState = cookies[OAUTH_STATE_COOKIE]
      const code = input.authorizationCode?.trim()
      if (!code || !input.state || !expectedState || input.state !== expectedState) {
        return { kind: 'failed', title: '无法完成知乎授权', message: '授权回调缺少有效的 authorization_code 或 state，不能把这次跳转当成登录成功。' }
      }
      if (!oauthTokenAllowed(ZHIHU_OAUTH_TOKEN_URL)) {
        return { kind: 'failed', title: '无法完成知乎授权', message: 'OAuth token 端点不在允许的知乎开放域。' }
      }
      const body = new URLSearchParams({
        app_id: ports.oauth.config.appId,
        app_key: ports.oauth.config.appKey,
        grant_type: 'authorization_code',
        redirect_uri: ports.oauth.config.redirectUri,
        code,
      })
      try {
        const response = await ports.http(ZHIHU_OAUTH_TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        })
        const text = await response.text()
        if (!response.ok) {
          return { kind: 'failed', title: '无法完成知乎授权', message: '知乎 access_token 交换失败，不能把这次回调当成登录成功。' }
        }
        let payload: unknown
        try {
          payload = JSON.parse(text) as unknown
        } catch {
          return { kind: 'failed', title: '无法完成知乎授权', message: '知乎 access_token 响应无法解析。' }
        }
        const token = parseTokenPayload(payload)
        if (!token) {
          return { kind: 'failed', title: '无法完成知乎授权', message: '知乎没有返回可用的 access_token。' }
        }
        const session = {
          id: randomUUID(),
          provider: 'zhihu' as const,
          tokenType: token.tokenType,
          accessToken: token.accessToken,
          expiresAt: ports.clock.unixSeconds() + token.expiresIn,
        }
        sessions.set(session.id, session)
        return {
          kind: 'authenticated',
          session: { id: session.id, provider: session.provider, tokenType: session.tokenType, expiresAt: session.expiresAt },
          sessionMaxAge: token.expiresIn,
        }
      } catch {
        return { kind: 'failed', title: '无法完成知乎授权', message: '知乎 OAuth 服务不可用，不能把这次回调当成登录成功。' }
      }
    },

    sessionFromCookie(cookieHeader: string | undefined): AuthSessionView {
      const id = parseCookies(cookieHeader)[SESSION_COOKIE]
      if (!id) return { kind: 'anonymous' }
      const session = sessions.get(id)
      if (!session || session.expiresAt <= ports.clock.unixSeconds()) {
        if (id) sessions.delete(id)
        return { kind: 'anonymous' }
      }
      return { kind: 'authenticated', provider: 'zhihu' }
    },

    logout(cookieHeader: string | undefined) {
      const id = parseCookies(cookieHeader)[SESSION_COOKIE]
      if (id) sessions.delete(id)
    },

    successRedirect(): string {
      return ports.oauth.ok ? ports.oauth.config.successRedirect : 'http://127.0.0.1:4301/'
    },

    failureRedirect(): string {
      const success = this.successRedirect()
      try {
        const url = new URL(success)
        url.hash = ''
        url.searchParams.set('oauth', 'failed')
        return url.toString()
      } catch {
        return 'http://127.0.0.1:4301/?oauth=failed'
      }
    },
  }
}

export type OauthService = ReturnType<typeof createOauthService>
