import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { FirstLearningOrchestrator } from './orchestrator.ts'

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function send(reply: FastifyReply, status: number, body: unknown) {
  return reply.code(status).type('application/json; charset=utf-8').send(body)
}

function queryId(request: FastifyRequest, key: string): string {
  const query = request.query as Record<string, unknown>
  return typeof query[key] === 'string' ? query[key] : ''
}

export function registerFirstLearningRoutes(app: FastifyInstance, ports: {
  firstLearning?: FirstLearningOrchestrator
  ready: boolean
}) {
  const missingConfig = (reply: FastifyReply, traceId: string) => send(reply, 503, {
    kind: 'failed',
    code: 'CONFIG_INVALID',
    message: 'Required Zhihu or DeepSeek configuration is missing.',
    traceId,
  })

  app.get('/api/learning/first-entry', async (request, reply) => {
    const traceId = String(request.headers['x-trace-id'] ?? `l0-${Date.now()}`)
    if (!ports.firstLearning) return send(reply, 503, { kind: 'failed', code: 'CONFIG_INVALID', message: '首次学习存储尚未接通。', traceId })
    const found = ports.firstLearning.get(queryId(request, 'routeId'), queryId(request, 'conceptId'))
    if (!found) return send(reply, 404, { kind: 'missing', traceId })
    return send(reply, 200, {
      kind: 'completed',
      reused: true,
      ...found.answer,
      graph: found.graph,
      draftCount: 0,
      traceId,
    })
  })

  app.post('/api/learning/first-entry', async (request, reply) => {
    const traceId = String(request.headers['x-trace-id'] ?? `l0-${Date.now()}`)
    if (!ports.ready || !ports.firstLearning) return missingConfig(reply, traceId)
    const body = asRecord(request.body) ?? {}
    const result = await ports.firstLearning.enter({
      routeId: typeof body.routeId === 'string' ? body.routeId : '',
      conceptId: typeof body.conceptId === 'string' ? body.conceptId : '',
      title: typeof body.title === 'string' ? body.title : undefined,
      hasDispute: body.hasDispute === true,
      detailedDescription: typeof body.detailedDescription === 'string' ? body.detailedDescription : undefined,
      attachmentSourceIds: Array.isArray(body.attachmentSourceIds)
        ? body.attachmentSourceIds.filter((item): item is string => typeof item === 'string')
        : undefined,
      thinkingDepth: body.thinkingDepth === 'deep' ? 'deep' : 'fast',
    })
    if (result.kind !== 'completed') {
      return send(reply, result.code === 'PROVIDER_INVALID' ? 400 : 503, { ...result, traceId })
    }
    return send(reply, 200, {
      kind: 'completed',
      reused: result.reused,
      ...result.answer,
      graph: result.graph,
      draftCount: 0,
      traceId,
    })
  })
}
