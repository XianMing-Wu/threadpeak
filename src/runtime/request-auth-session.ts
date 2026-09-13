import { ensureSession, resetSession } from '../learning-v2/client.ts'
import { createLiveApiClient, liveMessageOf } from './live-client.ts'
import type { FetchPort } from '@threadpeak/api-client'
import { resolveAuthSession, type AuthSessionResolution } from '../resolve-auth-session.ts'

export const AUTH_START_URL = '/api/auth/zhihu/start'
export const AUTH_SESSION_URL = '/api/auth/session'
export const AUTH_LOGOUT_URL = '/api/auth/logout'
export function oauthNotice(search:string):string {
  const status=new URLSearchParams(search).get('oauth')
  return status==='cancelled'?'已取消知乎授权，你可以重新登录或使用游客入口。':status==='busy'?'知乎暂时繁忙，请稍后重新连接。':status==='failed'?'知乎登录未完成，请重新尝试。':''
}

export type AuthStartResult =
  | { kind: 'redirect'; authorizeUrl: string }
  | AuthSessionResolution

export type AuthSessionView =
  | { kind: 'anonymous' }
  | { kind: 'guest' }
  | { kind: 'authenticated'; provider: 'zhihu' | 'account' }
  | AuthSessionResolution

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

export function isZhihuAuthorizeUrl(value: string, mode?: unknown, origin?: string): boolean {
  try {
    const url = new URL(value)
    if(url.username||url.password||url.hash)return false
    if(mode==='mock'&&origin){const local=new URL(origin);return ['localhost','127.0.0.1','[::1]'].includes(local.hostname)&&url.origin===local.origin&&url.pathname==='/api/auth/zhihu/callback'&&url.searchParams.get('authorization_code')?.startsWith('tp-demo.')===true}
    return url.protocol === 'https:'
      && url.origin === 'https://openapi.zhihu.com'
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
  if (posted.ok && body?.kind === 'redirect' && isZhihuAuthorizeUrl(authorizeUrl,body.mode,typeof window!=='undefined'?window.location.origin:undefined)) {
    return { kind: 'redirect', authorizeUrl }
  }
  return {
    ...fallback,
    message: liveMessageOf(posted.value, fallback.message),
  }
}

export async function requestAuthSession(fetchPort?: FetchPort): Promise<AuthSessionView> {
  if(!fetchPort)try{await ensureSession()}catch{return {kind:'anonymous'}}
  const posted = await createLiveApiClient(fetchPort).requestJson({
    url: AUTH_SESSION_URL,
    method: 'GET',
    traceId: 'auth-session',
  })
  const body = asRecord(posted.value)
  if (posted.ok && body?.kind === 'authenticated' && (body.provider === 'zhihu' || body.provider === 'account')) {
    return { kind: 'authenticated', provider: body.provider }
  }
  if (posted.ok && body?.kind === 'anonymous') return { kind: 'anonymous' }
  if (posted.ok && body?.kind === 'guest') return { kind: 'guest' }
  return resolveAuthSession()
}

export async function requestGuestSession(): Promise<void> {
  const response=await fetch('/api/auth/guest',{method:'POST',credentials:'same-origin',signal:AbortSignal.timeout(15000)})
  if(!response.ok)throw new Error('暂时无法进入，请稍后重试。')
  resetSession()
  await ensureSession()
}

export async function requestAuthLogout(fetchPort?: FetchPort): Promise<void> {
  const response=await createLiveApiClient(fetchPort).requestJson({
    url: AUTH_LOGOUT_URL,
    method: 'POST',
    traceId: 'auth-logout',
  })
  if(!response.ok)throw new Error('退出登录暂未完成，请重试。')
  resetSession()
}
