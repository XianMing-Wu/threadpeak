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
    title: '问山账号',
    message: '打开账号菜单',
  }
}
