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
    message: '登录还没有接通服务端 OAuth。不能把本地开关或延时动画当成知乎账号授权成功。',
  }
}
