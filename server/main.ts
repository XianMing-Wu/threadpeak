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
import { createGraphSurgeon } from './knowledge/graph-surgeon.ts'
import { createAgentLlmProvider } from './agent-runtime/llm-provider.ts'
import { createAgentZhihuProvider } from './agent-runtime/zhihu-provider.ts'
import { invokeStructuredAgent, invokeTextAgent } from './agent-runtime/invoke.ts'
import { createLlmSummarizer } from './agent-runtime/summarizer.ts'
import { createPathOrchestrator } from './path-generation/orchestrator.ts'
import { createFirstLearningOrchestrator } from './first-learning/orchestrator.ts'
import { createFollowUpOrchestrator } from './follow-up/orchestrator.ts'
import { createAuthorsOrchestrator } from './authors/orchestrator.ts'
import { createInMemoryAuthorNetworkProjector } from './authors/network.ts'
import { createOrdinaryChatOrchestrator } from './ordinary-chat/orchestrator.ts'

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
  const timeout = AbortSignal.timeout(90_000)
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
    body: response.body,
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
const graph = createGraphSurgeon(canonical)
const agentRuntime = config.ok
  ? (() => {
    const llm = createAgentLlmProvider({ config: config.config, http })
    const zhihu = createAgentZhihuProvider({ config: config.config, http, clock })
    const summarizer = createLlmSummarizer({ llm })
    return { llm, zhihu, summarizer }
  })()
  : undefined
const pathOrchestrator = agentRuntime
  ? createPathOrchestrator({
    invokeStructured: (agentId, context, options) => invokeStructuredAgent(agentRuntime, agentId, context, options),
    invokeText: (agentId, context, options) => invokeTextAgent(agentRuntime, agentId, context, options),
    search: (query, count) => agentRuntime.zhihu.search(query, count),
  })
  : undefined
const firstLearning = agentRuntime
  ? createFirstLearningOrchestrator({
    invokeStructured: (agentId, context, options) => invokeStructuredAgent(agentRuntime, agentId, context, options),
    invokeText: (agentId, context, options) => invokeTextAgent(agentRuntime, agentId, context, options),
    ...(pathOrchestrator
      ? { lookupConcept: (routeId, conceptId) => pathOrchestrator.getPublishedConcept(routeId, conceptId) }
      : {}),
  })
  : undefined
const followUp = agentRuntime
  ? createFollowUpOrchestrator({
    invokeStructured: (agentId, context, options) => invokeStructuredAgent(agentRuntime, agentId, context, options),
    invokeText: (agentId, context, options) => invokeTextAgent(agentRuntime, agentId, context, options),
  })
  : undefined
const authors = agentRuntime
  ? createAuthorsOrchestrator({
    invokeStructured: (agentId, context, options) => invokeStructuredAgent(agentRuntime, agentId, context, options),
    invokeText: (agentId, context, options) => invokeTextAgent(agentRuntime, agentId, context, options),
    search: (query, count) => agentRuntime.zhihu.search(query, count),
    network: createInMemoryAuthorNetworkProjector(),
  })
  : undefined
const ordinaryChat = agentRuntime
  ? createOrdinaryChatOrchestrator({
    invokeText: (agentId, context, options) => invokeTextAgent(agentRuntime, agentId, context, options),
  })
  : undefined

const server = await createCompositionApp({
  config,
  http,
  oauth,
  canonical,
  graph,
  ...(service ? { service } : {}),
  ...(pathOrchestrator ? { pathOrchestrator } : {}),
  ...(firstLearning ? { firstLearning } : {}),
  ...(followUp ? { followUp } : {}),
  ...(authors ? { authors } : {}),
  ...(ordinaryChat ? { ordinaryChat } : {}),
  ...(config.ok && config.config.pathGenerateUpstream
    ? { pathGenerateUpstream: config.config.pathGenerateUpstream }
    : {}),
})

const bound = await listenLiveServer(server)
process.stdout.write(`threadpeak-live ${bound.host}:${bound.port} ready=${config.ok ? 'yes' : 'no'}\n`)
