export type SettingsIdentityResolution = {
  kind: 'unavailable'
  reason: 'missing-identity-provider'
  title: string
  message: string
}

export type SettingsSourcesResolution = {
  kind: 'unavailable'
  reason: 'missing-sources-provider'
  title: string
  message: string
}

export function resolveSettingsIdentity(): SettingsIdentityResolution {
  return {
    kind: 'unavailable',
    reason: 'missing-identity-provider',
    title: '无法显示登录身份',
    message: '现在读不到你的账号。请稍后再试。',
  }
}

export function resolveSettingsSources(): SettingsSourcesResolution {
  return {
    kind: 'unavailable',
    reason: 'missing-sources-provider',
    title: '无法设置资料范围',
    message: '资料范围还没有生效。请重新选择。',
  }
}
