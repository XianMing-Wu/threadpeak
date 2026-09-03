import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { PathAttachment, PathOrchestrator } from './orchestrator.ts'
import type { ThinkingDepth } from '../agent-runtime/types.ts'

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function attachmentsOf(value: unknown): PathAttachment[] {
  if (!Array.isArray(value)) return []
  const items: PathAttachment[] = []
  for (const raw of value) {
    const record = asRecord(raw)
    const sourceId = typeof record?.sourceId === 'string' ? record.sourceId.trim() : ''
    const fileName = typeof record?.fileName === 'string' ? record.fileName.trim() : ''
    const content = typeof record?.content === 'string' ? record.content : ''
    if (!sourceId || !fileName) continue
    const mimeType = record?.mimeType
    items.push({
      sourceId,
      fileName,
      content,
      ...(mimeType === 'application/pdf' || mimeType === 'text/markdown' || mimeType === 'text/plain'
        ? { mimeType }
        : {}),
    })
  }
  return items
}

function thinkingOf(value: unknown): ThinkingDepth {
  return value === 'deep' ? 'deep' : 'fast'
}

function send(reply: FastifyReply, status: number, body: unknown) {
  return reply.code(status).type('application/json; charset=utf-8').send(body)
}

function statusOf(view: { status: string; error?: { code: string } }): number {
  if (view.status === 'failed' || view.error) {
    const code = view.error?.code
    if (code === 'PROVIDER_INVALID') return 400
    if (code === 'CONFIG_INVALID') return 503
    if (view.status === 'failed') return 503
    return 400
  }
  return 200
}

export function registerPathRunRoutes(app: FastifyInstance, ports: {
  orchestrator?: PathOrchestrator
  ready: boolean
}) {
  const missing = (reply: FastifyReply, traceId: string) => send(reply, 503, {
    kind: 'failed',
    status: 'failed',
    stage: 'failed',
    questionSets: [],
    knowledgeCreated: false,
    error: { code: 'CONFIG_INVALID', message: 'Required Zhihu or DeepSeek configuration is missing.' },
    traceId,
  })

  app.post('/api/path-runs', async (request: FastifyRequest, reply: FastifyReply) => {
    const traceId = String(request.headers['x-trace-id'] ?? `path-${Date.now()}`)
    if (!ports.ready || !ports.orchestrator) return missing(reply, traceId)
    const body = asRecord(request.body) ?? {}
    const view = await ports.orchestrator.start({
      goal: typeof body.goal === 'string' ? body.goal : '',
      attachments: attachmentsOf(body.attachments),
      thinkingDepth: thinkingOf(body.thinkingDepth),
    })
    return send(reply, statusOf(view), { ...view, traceId })
  })

  app.post('/api/path-runs/:runId/select', async (request: FastifyRequest, reply: FastifyReply) => {
    const traceId = String(request.headers['x-trace-id'] ?? `path-${Date.now()}`)
    if (!ports.ready || !ports.orchestrator) return missing(reply, traceId)
    const runId = String((request.params as { runId?: string }).runId ?? '')
    const body = asRecord(request.body) ?? {}
    const view = await ports.orchestrator.select({
      runId,
      questionId: typeof body.questionId === 'string' ? body.questionId : '',
      optionId: typeof body.optionId === 'string' ? body.optionId : '',
    })
    return send(reply, statusOf(view), { ...view, traceId })
  })

  app.post('/api/path-runs/:runId/commit', async (request: FastifyRequest, reply: FastifyReply) => {
    const traceId = String(request.headers['x-trace-id'] ?? `path-${Date.now()}`)
    if (!ports.ready || !ports.orchestrator) return missing(reply, traceId)
    const runId = String((request.params as { runId?: string }).runId ?? '')
    const view = await ports.orchestrator.commit(runId)
    return send(reply, statusOf(view), { ...view, traceId })
  })

  app.post('/api/path-runs/:runId/follow-up', async (request: FastifyRequest, reply: FastifyReply) => {
    const traceId = String(request.headers['x-trace-id'] ?? `path-${Date.now()}`)
    if (!ports.ready || !ports.orchestrator) return missing(reply, traceId)
    const runId = String((request.params as { runId?: string }).runId ?? '')
    const body = asRecord(request.body) ?? {}
    const view = await ports.orchestrator.followUp({
      runId,
      message: typeof body.message === 'string' ? body.message : '',
    })
    return send(reply, statusOf(view), { ...view, traceId })
  })

  app.post('/api/path-runs/:runId/retry', async (request: FastifyRequest, reply: FastifyReply) => {
    const traceId = String(request.headers['x-trace-id'] ?? `path-${Date.now()}`)
    if (!ports.ready || !ports.orchestrator) return missing(reply, traceId)
    const runId = String((request.params as { runId?: string }).runId ?? '')
    const view = await ports.orchestrator.retry(runId)
    return send(reply, statusOf(view), { ...view, traceId })
  })

  app.post('/api/path-runs/:runId/reply', async (request: FastifyRequest, reply: FastifyReply) => {
    const traceId = String(request.headers['x-trace-id'] ?? `path-${Date.now()}`)
    if (!ports.ready || !ports.orchestrator) return missing(reply, traceId)
    const runId = String((request.params as { runId?: string }).runId ?? '')
    const body = asRecord(request.body) ?? {}
    const view = await ports.orchestrator.reply({
      runId,
      message: typeof body.message === 'string' ? body.message : '',
    })
    return send(reply, statusOf(view), { ...view, traceId })
  })
}
