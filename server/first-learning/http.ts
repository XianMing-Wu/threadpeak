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
    trace: [],
    traceId,
  })

  app.get('/api/learning/first-entry', async (request, reply) => {
    const traceId = String(request.headers['x-trace-id'] ?? `l0-${Date.now()}`)
    if (!ports.firstLearning) return send(reply, 503, { kind: 'failed', code: 'CONFIG_INVALID', message: '现在读不到第一段讲解。请稍后再试。', trace: [], traceId })
    const peeked = ports.firstLearning.peek(queryId(request, 'routeId'), queryId(request, 'conceptId'))
    if (peeked.kind === 'missing') return send(reply, 404, { kind: 'missing', trace: [], traceId })
    if (peeked.kind === 'running') {
      return send(reply, 200, {
        kind: 'running',
        trace: peeked.trace,
        ...(peeked.draftText ? { draftText: peeked.draftText } : {}),
        traceId,
      })
    }
    if (peeked.kind === 'failed') {
      return send(reply, 200, { kind: 'failed', code: peeked.code, message: peeked.message, trace: peeked.trace, traceId })
    }
    return send(reply, 200, {
      kind: 'completed',
      reused: true,
      ...peeked.answer,
      graph: peeked.graph,
      trace: peeked.trace,
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
      wait: false,
    })
    if (result.kind === 'running') {
      return send(reply, 200, {
        kind: 'running',
        trace: result.trace,
        ...(result.draftText ? { draftText: result.draftText } : {}),
        traceId,
      })
    }
    if (result.kind !== 'completed') {
      return send(reply, result.code === 'PROVIDER_INVALID' ? 400 : 503, { ...result, traceId })
    }
    return send(reply, 200, {
      kind: 'completed',
      reused: result.reused,
      ...result.answer,
      graph: result.graph,
      trace: result.trace,
      draftCount: 0,
      traceId,
    })
  })
}
