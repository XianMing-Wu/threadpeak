export type AuthSessionResolution = {
  kind: 'unavailable'
  reason: 'missing-oauth-provider'
  title: string
  message: string
}

export function resolveAuthSession(): AuthSessionResolution {
  return {
    kind: 'unavailable',
    reason: 'missing-oauth-provider',
    title: '无法完成知乎授权',
    message: '现在无法完成知乎登录。请稍后再试。',
  }
}
