import { randomUUID } from 'node:crypto'
import Fastify, { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify'
import type { ConfigResolution, ProviderConfig } from './config.ts'
import type { LiveService } from './live-service.ts'
import type { HttpPort } from './ports.ts'
import { loadPathRuntimeConfig } from './path/config.ts'
import { buildPathApp } from './path/http.ts'
import { InMemoryPathSessionStore } from './path/service.ts'

const LISTEN_HOST = '127.0.0.1'
const LISTEN_PORT = 4312

type Json = Record<string, unknown>

export type LiveHttpPorts = {
  config: ConfigResolution
  service?: LiveService
  pathGenerateUpstream?: string
  http: HttpPort
}

function traceIdOf(request: FastifyRequest): string {
  const header = request.headers['x-trace-id']
  const value = Array.isArray(header) ? header[0] : header
  return value?.trim() || `live-${randomUUID()}`
}

function asRecord(value: unknown): Json | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Json
}

function sendJson(reply: FastifyReply, status: number, body: Json) {
  return reply.code(status).type('application/json; charset=utf-8').send(body)
}

function pathConfigFrom(config: ProviderConfig) {
  return loadPathRuntimeConfig({
    DEEPSEEK_BASE_URL: config.deepseekBaseUrl,
    DEEPSEEK_API_KEY: config.deepseekApiKey,
    DEEPSEEK_MODEL_NAME: config.deepseekModelName,
    ZHIHU_API_BASE_URL: config.zhihuApiBaseUrl,
    ZHIHU_ACCESS_SECRET: config.zhihuAccessSecret,
    THREADPEAK_ALLOW_LIVE_CALLS: '1',
  })
}

export function registerLiveRoutes(app: FastifyInstance, ports: LiveHttpPorts) {
  app.get('/health', async () => ({ ok: true }))

  const ready = async (request: FastifyRequest, reply: FastifyReply) => {
    const traceId = traceIdOf(request)
    if (!ports.config.ok) {
      return sendJson(reply, 503, {
        ready: false,
        code: 'CONFIG_INVALID',
        message: 'Required Zhihu or DeepSeek configuration is missing.',
        traceId,
      })
    }
    return sendJson(reply, 200, { ready: true, traceId })
  }
  app.get('/ready', ready)
  app.get('/api/ready', ready)

  app.post('/api/paths/generate', async (request, reply) => {
    const traceId = traceIdOf(request)
    if (!ports.config.ok || !ports.service) {
      return sendJson(reply, 503, {
        kind: 'failed',
        code: 'CONFIG_INVALID',
        message: 'Required Zhihu or DeepSeek configuration is missing.',
        traceId,
      })
    }
    if (!ports.pathGenerateUpstream) {
      return sendJson(reply, 503, {
        code: 'providers_unavailable',
        message: 'JSON 路径实验接口未启用。产品路线制定请使用 /api/paths/generate/stream。',
        traceId,
      })
    }
    const forwarded = await ports.http(new URL('/api/paths/generate', `${ports.pathGenerateUpstream}/`).toString(), {
      method: 'POST',
      headers: { 'content-type': request.headers['content-type'] || 'application/json' },
      body: JSON.stringify(request.body ?? {}),
    })
    const text = await forwarded.text()
    reply.code(forwarded.status).type('application/json; charset=utf-8')
    return reply.send(text)
  })

  app.post('/api/answers', async (request, reply) => {
    const traceId = traceIdOf(request)
    if (!ports.config.ok || !ports.service) {
      return sendJson(reply, 503, {
        kind: 'failed',
        code: 'CONFIG_INVALID',
        message: 'Required Zhihu or DeepSeek configuration is missing.',
        traceId,
      })
    }
    const payload = asRecord(request.body) ?? {}
    const result = await ports.service.ordinaryAnswer({
      question: typeof payload.question === 'string' ? payload.question : '',
      ...(typeof payload.topic === 'string' ? { topic: payload.topic } : {}),
      ...(typeof payload.quote === 'string' ? { quote: payload.quote } : {}),
    })
    return sendJson(reply, result.kind === 'completed' ? 200 : 503, { ...result, traceId })
  })

  app.post('/api/ask-author', async (request, reply) => {
    const traceId = traceIdOf(request)
    if (!ports.config.ok || !ports.service) {
      return sendJson(reply, 503, {
        kind: 'failed',
        code: 'CONFIG_INVALID',
        message: 'Required Zhihu or DeepSeek configuration is missing.',
        traceId,
      })
    }
    const payload = asRecord(request.body) ?? {}
    const result = await ports.service.askAuthor({
      question: typeof payload.question === 'string' ? payload.question : '',
      quote: typeof payload.quote === 'string' ? payload.quote : '',
    })
    return sendJson(reply, result.kind === 'failed' ? 503 : 200, { ...result, traceId })
  })

  app.post('/api/authors/search', async (request, reply) => {
    const traceId = traceIdOf(request)
    if (!ports.config.ok || !ports.service) {
      return sendJson(reply, 503, {
        kind: 'failed',
        code: 'CONFIG_INVALID',
        message: 'Required Zhihu or DeepSeek configuration is missing.',
        traceId,
      })
    }
    const payload = asRecord(request.body) ?? {}
    const result = await ports.service.authorSearch({
      query: typeof payload.query === 'string' ? payload.query : '',
    })
    return sendJson(reply, result.kind === 'failed' ? 503 : 200, { ...result, traceId })
  })
}

export async function createCompositionApp(ports: LiveHttpPorts): Promise<FastifyInstance> {
  const app = ports.config.ok
    ? await buildPathApp({
      config: pathConfigFrom(ports.config.config),
      store: new InMemoryPathSessionStore(),
    })
    : Fastify({ logger: false })
  if (!ports.config.ok) {
    app.post('/api/paths/generate/stream', async (request, reply) => {
      return sendJson(reply, 503, {
        code: 'CONFIG_INVALID',
        message: 'Required Zhihu or DeepSeek configuration is missing.',
        traceId: traceIdOf(request),
      })
    })
  }
  registerLiveRoutes(app, ports)
  return app
}

export async function listenLiveServer(app: FastifyInstance) {
  await app.listen({ host: LISTEN_HOST, port: LISTEN_PORT })
  return { host: LISTEN_HOST, port: LISTEN_PORT }
}
