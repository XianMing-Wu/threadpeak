import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { resolveProviderConfig } from './config.ts'
import { createDeepSeekAnswerAdapter, createDeepSeekReviewAdapter } from './deepseek.adapter.ts'
import { createCompositionApp, listenLiveServer } from './http.ts'
import { createLiveService } from './live-service.ts'
import { createUnavailableAuthorNetwork, type HttpPort } from './ports.ts'
import { createZhihuDirectAdapter, createZhihuSearchAdapter } from './zhihu.adapter.ts'
import { resolveOauthConfig } from './identity/oauth-config.ts'
import { createOauthService } from './identity/oauth.ts'
import { createCanonicalAnswerStore } from './knowledge/canonical-answer.ts'

function loadDotEnv(filePath: string): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = { ...process.env }
  try {
    const source = readFileSync(filePath, 'utf8')
    for (const line of source.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const splitAt = trimmed.indexOf('=')
      if (splitAt <= 0) continue
      const key = trimmed.slice(0, splitAt).trim()
      const value = trimmed.slice(splitAt + 1).trim()
      if (!(key in env) || env[key] === '') env[key] = value
    }
  } catch {
    // Composition still reads process.env; missing file is a readiness failure later.
  }
  return env
}

const http: HttpPort = async (url, init) => {
  const timeout = AbortSignal.timeout(20_000)
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout
  const response = await fetch(url, {
    method: init?.method ?? 'GET',
    headers: init?.headers,
    body: init?.body,
    signal,
  })
  return {
    ok: response.ok,
    status: response.status,
    text: () => response.text(),
  }
}

const clock = {
  now: () => new Date(),
  unixSeconds: () => Math.floor(Date.now() / 1000),
}

const env = loadDotEnv(resolve(process.cwd(), '.env'))
const config = resolveProviderConfig(env)
const service = config.ok
  ? createLiveService({
    search: createZhihuSearchAdapter({ config: config.config, http, clock }),
    answer: createDeepSeekAnswerAdapter({ config: config.config, http }),
    review: createDeepSeekReviewAdapter({ config: config.config, http }),
    direct: createZhihuDirectAdapter({ config: config.config, http, clock }),
    network: createUnavailableAuthorNetwork(),
  })
  : undefined

const oauth = createOauthService({
  oauth: resolveOauthConfig(env),
  http,
  clock,
})
const canonical = createCanonicalAnswerStore()

const server = await createCompositionApp({
  config,
  http,
  oauth,
  canonical,
  ...(service ? { service } : {}),
  ...(config.ok && config.config.pathGenerateUpstream
    ? { pathGenerateUpstream: config.config.pathGenerateUpstream }
    : {}),
})

const bound = await listenLiveServer(server)
process.stdout.write(`threadpeak-live ${bound.host}:${bound.port} ready=${config.ok ? 'yes' : 'no'}\n`)
