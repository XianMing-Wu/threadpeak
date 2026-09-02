import { createLiveApiClient, liveMessageOf } from './live-client.ts'
import type { FetchPort } from '@threadpeak/api-client'
import { resolveAuthSession, type AuthSessionResolution } from '../resolve-auth-session.ts'

export const AUTH_START_URL = '/api/auth/zhihu/start'
export const AUTH_SESSION_URL = '/api/auth/session'
export const AUTH_LOGOUT_URL = '/api/auth/logout'

export type AuthStartResult =
  | { kind: 'redirect'; authorizeUrl: string }
  | AuthSessionResolution

export type AuthSessionView =
  | { kind: 'anonymous' }
  | { kind: 'authenticated'; provider: 'zhihu' }
  | AuthSessionResolution

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function isZhihuAuthorizeUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:'
      && url.hostname === 'openapi.zhihu.com'
      && url.pathname === '/authorize'
  } catch {
    return false
  }
}

export async function requestAuthStart(fetchPort?: FetchPort): Promise<AuthStartResult> {
  const fallback = resolveAuthSession()
  const posted = await createLiveApiClient(fetchPort).requestJson({
    url: AUTH_START_URL,
    method: 'GET',
    traceId: 'auth-start',
  })
  const body = asRecord(posted.value)
  const authorizeUrl = typeof body?.authorizeUrl === 'string' ? body.authorizeUrl : ''
  if (posted.ok && body?.kind === 'redirect' && isZhihuAuthorizeUrl(authorizeUrl)) {
    return { kind: 'redirect', authorizeUrl }
  }
  return {
    ...fallback,
    message: liveMessageOf(posted.value, fallback.message),
  }
}

export async function requestAuthSession(fetchPort?: FetchPort): Promise<AuthSessionView> {
  const posted = await createLiveApiClient(fetchPort).requestJson({
    url: AUTH_SESSION_URL,
    method: 'GET',
    traceId: 'auth-session',
  })
  const body = asRecord(posted.value)
  if (posted.ok && body?.kind === 'authenticated' && body.provider === 'zhihu') {
    return { kind: 'authenticated', provider: 'zhihu' }
  }
  if (posted.ok && body?.kind === 'anonymous') return { kind: 'anonymous' }
  return resolveAuthSession()
}

export async function requestAuthLogout(fetchPort?: FetchPort): Promise<void> {
  await createLiveApiClient(fetchPort).requestJson({
    url: AUTH_LOGOUT_URL,
    method: 'POST',
    traceId: 'auth-logout',
  })
}
