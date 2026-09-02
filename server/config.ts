export const PROVIDER_ENV_KEYS = [
  'ZHIHU_ACCESS_SECRET',
  'ZHIHU_API_BASE_URL',
  'DEEPSEEK_API_KEY',
  'DEEPSEEK_BASE_URL',
  'DEEPSEEK_MODEL_NAME',
] as const

export type ProviderEnvKey = (typeof PROVIDER_ENV_KEYS)[number]

export type ProviderConfig = {
  zhihuAccessSecret: string
  zhihuApiBaseUrl: string
  deepseekApiKey: string
  deepseekBaseUrl: string
  deepseekModelName: string
  pathGenerateUpstream?: string
}

export type ConfigResolution =
  | { ok: true; config: ProviderConfig }
  | { ok: false; code: 'CONFIG_INVALID'; missing: readonly ProviderEnvKey[] }

const MAX_URL_LENGTH = 200
const MAX_SECRET_LENGTH = 4096
const MAX_MODEL_LENGTH = 80

function readTrimmed(env: Record<string, string | undefined>, key: ProviderEnvKey): string {
  return env[key]?.trim() ?? ''
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password && value.length <= MAX_URL_LENGTH
  } catch {
    return false
  }
}

export function resolveProviderConfig(env: Record<string, string | undefined>): ConfigResolution {
  const missing = PROVIDER_ENV_KEYS.filter((key) => !readTrimmed(env, key))
  if (missing.length > 0) return { ok: false, code: 'CONFIG_INVALID', missing }

  const zhihuApiBaseUrl = readTrimmed(env, 'ZHIHU_API_BASE_URL').replace(/\/+$/, '')
  const deepseekBaseUrl = readTrimmed(env, 'DEEPSEEK_BASE_URL').replace(/\/+$/, '')
  const zhihuAccessSecret = readTrimmed(env, 'ZHIHU_ACCESS_SECRET')
  const deepseekApiKey = readTrimmed(env, 'DEEPSEEK_API_KEY')
  const deepseekModelName = readTrimmed(env, 'DEEPSEEK_MODEL_NAME')
  if (!isHttpUrl(zhihuApiBaseUrl) || !isHttpUrl(deepseekBaseUrl)) {
    return { ok: false, code: 'CONFIG_INVALID', missing: ['ZHIHU_API_BASE_URL', 'DEEPSEEK_BASE_URL'] }
  }
  if (zhihuAccessSecret.length > MAX_SECRET_LENGTH || deepseekApiKey.length > MAX_SECRET_LENGTH) {
    return { ok: false, code: 'CONFIG_INVALID', missing: ['ZHIHU_ACCESS_SECRET', 'DEEPSEEK_API_KEY'] }
  }
  if (deepseekModelName.length > MAX_MODEL_LENGTH) {
    return { ok: false, code: 'CONFIG_INVALID', missing: ['DEEPSEEK_MODEL_NAME'] }
  }

  const pathGenerateUpstream = env.PATH_GENERATE_UPSTREAM?.trim().replace(/\/+$/, '')
  return {
    ok: true,
    config: {
      zhihuAccessSecret,
      zhihuApiBaseUrl,
      deepseekApiKey,
      deepseekModelName,
      deepseekBaseUrl,
      ...(pathGenerateUpstream && isHttpUrl(pathGenerateUpstream) ? { pathGenerateUpstream } : {}),
    },
  }
}

export function allowedOrigin(baseUrl: string): string {
  return new URL(baseUrl).origin
}
