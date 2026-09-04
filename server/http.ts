import { randomUUID } from 'node:crypto'
import Fastify, { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify'
import type { ConfigResolution } from './config.ts'
import type { HttpPort } from './ports.ts'
import { registerPathRunRoutes } from './path-generation/http.ts'
import type { PathOrchestrator } from './path-generation/orchestrator.ts'
import { registerFirstLearningRoutes } from './first-learning/http.ts'
import type { FirstLearningOrchestrator } from './first-learning/orchestrator.ts'
import { registerFollowUpRoutes } from './follow-up/http.ts'
import type { FollowUpOrchestrator } from './follow-up/orchestrator.ts'
import { registerAuthorRoutes } from './authors/http.ts'
import type { AuthorsOrchestrator } from './authors/orchestrator.ts'
import { registerOrdinaryChatRoutes } from './ordinary-chat/http.ts'
import type { OrdinaryChatOrchestrator } from './ordinary-chat/orchestrator.ts'
import { registerAuthRoutes } from './identity/http.ts'
import type { OauthService } from './identity/oauth.ts'
import type { CanonicalAnswerStore } from './knowledge/canonical-answer.ts'
import type { GraphSurgeonStore } from './knowledge/graph-surgeon.ts'

const LISTEN_HOST = '127.0.0.1'
const LISTEN_PORT = 4312

type Json = Record<string, unknown>

export type LiveHttpPorts = {
  config: ConfigResolution
  http: HttpPort
  oauth?: OauthService
  canonical?: CanonicalAnswerStore
  graph?: GraphSurgeonStore
  pathOrchestrator?: PathOrchestrator
  firstLearning?: FirstLearningOrchestrator
  followUp?: FollowUpOrchestrator
  authors?: AuthorsOrchestrator
  ordinaryChat?: OrdinaryChatOrchestrator
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

  app.get('/api/learning/canonical-answer', async (request, reply) => {
    const traceId = traceIdOf(request)
    if (!ports.canonical) {
      return sendJson(reply, 503, { kind: 'failed', code: 'CONFIG_INVALID', message: '现在读不到第一段讲解。请稍后再试。', traceId })
    }
    const query = request.query as Record<string, unknown>
    const routeId = typeof query.routeId === 'string' ? query.routeId : ''
    const conceptId = typeof query.conceptId === 'string' ? query.conceptId : ''
    const found = ports.firstLearning?.getCanonical(routeId, conceptId) ?? ports.canonical.get(routeId, conceptId)
    if (!found) return sendJson(reply, 404, { kind: 'missing', traceId })
    return sendJson(reply, 200, { kind: 'completed', reused: true, ...found, traceId })
  })

  app.post('/api/learning/canonical-answer', async (request, reply) => {
    const traceId = traceIdOf(request)
    if (!ports.config.ok || !ports.firstLearning) {
      return sendJson(reply, 503, {
        kind: 'failed',
        code: 'CONFIG_INVALID',
        message: 'Required Zhihu or DeepSeek configuration is missing.',
        traceId,
      })
    }
    const payload = asRecord(request.body) ?? {}
    const result = await ports.firstLearning.enter({
      routeId: typeof payload.routeId === 'string' ? payload.routeId : '',
      conceptId: typeof payload.conceptId === 'string' ? payload.conceptId : '',
      title: typeof payload.title === 'string' ? payload.title : undefined,
      hasDispute: payload.hasDispute === true,
      detailedDescription: typeof payload.detailedDescription === 'string' ? payload.detailedDescription : undefined,
      attachmentSourceIds: Array.isArray(payload.attachmentSourceIds)
        ? payload.attachmentSourceIds.filter((item): item is string => typeof item === 'string')
        : undefined,
      thinkingDepth: payload.thinkingDepth === 'deep' ? 'deep' : 'fast',
    })
    if (result.kind !== 'completed') {
      return sendJson(reply, result.code === 'PROVIDER_INVALID' ? 400 : 503, { ...result, traceId })
    }
    return sendJson(reply, 200, {
      kind: 'completed',
      reused: result.reused,
      ...result.answer,
      graph: result.graph,
      draftCount: 0,
      traceId,
    })
  })

  app.get('/api/learning/graph', async (request, reply) => {
    const traceId = traceIdOf(request)
    if (!ports.graph) {
      return sendJson(reply, 503, { kind: 'failed', code: 'CONFIG_INVALID', message: '现在读不到知识脉络。请稍后再试。', traceId })
    }
    const query = request.query as Record<string, unknown>
    const routeId = typeof query.routeId === 'string' ? query.routeId : ''
    const conceptId = typeof query.conceptId === 'string' ? query.conceptId : ''
    const found = ports.firstLearning?.getGraph(routeId, conceptId) ?? ports.graph.get(routeId, conceptId)
    if (!found) return sendJson(reply, 404, { kind: 'missing', traceId })
    return sendJson(reply, 200, { kind: 'completed', reused: true, draftCount: 0, ...found, traceId })
  })

  app.post('/api/learning/graph', async (request, reply) => {
    const traceId = traceIdOf(request)
    if (!ports.graph) {
      return sendJson(reply, 503, {
        kind: 'failed',
        code: 'CONFIG_INVALID',
        message: '现在读不到知识脉络。请稍后再试。',
        traceId,
      })
    }
    const payload = asRecord(request.body) ?? {}
    const routeId = typeof payload.routeId === 'string' ? payload.routeId : ''
    const conceptId = typeof payload.conceptId === 'string' ? payload.conceptId : ''
    if (ports.firstLearning) {
      const settled = ports.firstLearning.getGraph(routeId, conceptId)
      if (settled) {
        return sendJson(reply, 200, { kind: 'completed', reused: true, draftCount: 0, ...settled, traceId })
      }
      return sendJson(reply, 409, {
        kind: 'failed',
        code: 'CANONICAL_MISSING',
        message: '首次回复尚未成功，不能单独创建知识脉络。',
        traceId,
      })
    }
    const result = await ports.graph.bootstrap({
      routeId,
      conceptId,
      title: typeof payload.title === 'string' ? payload.title : '',
    })
    if (result.kind !== 'completed') {
      const status = result.code === 'INVALID_SCOPE' ? 400 : result.code === 'CANONICAL_MISSING' ? 409 : 503
      return sendJson(reply, status, { ...result, traceId })
    }
    return sendJson(reply, 200, {
      kind: 'completed',
      reused: result.reused,
      draftCount: result.draftCount,
      ...result.graph,
      traceId,
    })
  })
}

export async function createCompositionApp(ports: LiveHttpPorts): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    requestTimeout: 180_000,
    connectionTimeout: 180_000,
  })
  registerLiveRoutes(app, ports)
  registerPathRunRoutes(app, {
    ready: ports.config.ok,
    ...(ports.pathOrchestrator ? { orchestrator: ports.pathOrchestrator } : {}),
  })
  registerFirstLearningRoutes(app, {
    ready: ports.config.ok,
    ...(ports.firstLearning ? { firstLearning: ports.firstLearning } : {}),
  })
  registerFollowUpRoutes(app, {
    ready: ports.config.ok,
    ...(ports.followUp ? { followUp: ports.followUp } : {}),
  })
  registerAuthorRoutes(app, {
    ready: ports.config.ok,
    ...(ports.authors ? { authors: ports.authors } : {}),
  })
  registerOrdinaryChatRoutes(app, {
    ready: ports.config.ok,
    ...(ports.ordinaryChat ? { ordinaryChat: ports.ordinaryChat } : {}),
  })
  if (ports.oauth) registerAuthRoutes(app, ports.oauth)
  return app
}

export async function listenLiveServer(app: FastifyInstance) {
  await app.listen({ host: LISTEN_HOST, port: LISTEN_PORT })
  return { host: LISTEN_HOST, port: LISTEN_PORT }
}
