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
    message: '设置还没有接通真实的服务端身份。不能用写死的姓名冒充当前登录用户。',
  }
}

export function resolveSettingsSources(): SettingsSourcesResolution {
  return {
    kind: 'unavailable',
    reason: 'missing-sources-provider',
    title: '无法设置资料范围',
    message: '资料范围还没有接通已提交的来源或附件。不能把已上传 PDF 或知乎范围当成已生效的检索范围。',
  }
}
