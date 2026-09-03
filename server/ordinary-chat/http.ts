import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { OrdinaryChatOrchestrator } from './orchestrator.ts'

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function asText(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function sendJson(reply: FastifyReply, status: number, body: Record<string, unknown>) {
  return reply.code(status).type('application/json; charset=utf-8').send(body)
}

function missing(reply: FastifyReply, traceId: string) {
  return sendJson(reply, 503, {
    kind: 'failed',
    code: 'CONFIG_INVALID',
    message: 'Required Zhihu or DeepSeek configuration is missing.',
    traceId,
  })
}

function payloadOf(body: Record<string, unknown>) {
  return {
    currentMessage: asText(body.currentMessage) || asText(body.question),
    conversation: body.conversation,
    attachments: body.attachments,
    thinkingDepth: body.thinkingDepth === 'deep' ? 'deep' as const : 'fast' as const,
  }
}

export function registerOrdinaryChatRoutes(app: FastifyInstance, ports: {
  ordinaryChat?: OrdinaryChatOrchestrator
  ready: boolean
}) {
  app.post('/api/answers', async (request: FastifyRequest, reply: FastifyReply) => {
    const traceId = String(request.headers['x-trace-id'] ?? `r5-${Date.now()}`)
    if (!ports.ready || !ports.ordinaryChat) return missing(reply, traceId)
    const result = await ports.ordinaryChat.reply(payloadOf(asRecord(request.body) ?? {}))
    return sendJson(reply, result.kind === 'completed' ? 200 : 503, { ...result, traceId })
  })

  app.post('/api/answers/stream', async (request: FastifyRequest, reply: FastifyReply) => {
    const traceId = String(request.headers['x-trace-id'] ?? `r5-${Date.now()}`)
    if (!ports.ready || !ports.ordinaryChat) return missing(reply, traceId)
    reply.hijack()
    reply.raw.writeHead(200, {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store',
      'x-accel-buffering': 'no',
    })
    const write = (event: Record<string, unknown>) => {
      reply.raw.write(`${JSON.stringify({ ...event, traceId })}\n`)
    }
    try {
      write({ kind: 'status', stage: 'compose' })
      const result = await ports.ordinaryChat.reply(payloadOf(asRecord(request.body) ?? {}))
      if (result.kind !== 'completed') {
        write({ kind: 'failed', code: result.code, message: result.message })
        reply.raw.end()
        return
      }
      write({ kind: 'delta', text: result.text })
      write({ kind: 'completed', text: result.text, compressed: result.compressed })
    } catch {
      write({ kind: 'failed', code: 'PROVIDER_UNAVAILABLE', message: '模型服务不可用，不能生成这次回答。' })
    }
    reply.raw.end()
  })
}
