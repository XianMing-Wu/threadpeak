export type AccountIdentityResolution = {
  kind: 'unavailable'
  reason: 'missing-identity-provider'
  title: string
  message: string
}

export function resolveAccountIdentity(): AccountIdentityResolution {
  return {
    kind: 'unavailable',
    reason: 'missing-identity-provider',
    title: '本地原型账号',
    message: '侧栏账号还没有接通真实的服务端身份。不能用写死的姓名冒充当前登录用户。',
  }
}
