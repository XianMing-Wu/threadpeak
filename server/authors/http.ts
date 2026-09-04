import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { AuthorsOrchestrator } from './orchestrator.ts'

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

function failedStatus(code: string) {
  return code === 'PROVIDER_INVALID' ? 400 : 503
}

function nested(value: unknown) {
  return asRecord(value) ?? {}
}

export function registerAuthorRoutes(app: FastifyInstance, ports: {
  authors?: AuthorsOrchestrator
  ready: boolean
}) {
  app.post('/api/ask-author', async (request: FastifyRequest, reply: FastifyReply) => {
    const traceId = String(request.headers['x-trace-id'] ?? `a-${Date.now()}`)
    if (!ports.ready || !ports.authors) {
      return sendJson(reply, 503, {
        kind: 'failed',
        code: 'CONFIG_INVALID',
        message: 'Required Zhihu or DeepSeek configuration is missing.',
        traceId,
      })
    }
    const body = asRecord(request.body) ?? {}
    const selection = nested(body.selection)
    const host = nested(body.host)
    const carrier = nested(body.carrier)
    const concept = nested(body.concept)
    const result = await ports.authors.ask({
      question: asText(body.question),
      selection: {
        text: asText(selection.text) || asText(body.quote),
        anchor: asText(selection.anchor) || asText(host.nodeId),
      },
      host: {
        nodeId: asText(host.nodeId),
        content: asText(host.content),
      },
      carrier: {
        id: asText(carrier.id),
        title: asText(carrier.title),
      },
      concept: {
        id: asText(concept.id),
        title: asText(concept.title),
      },
      thinkingDepth: body.thinkingDepth === 'deep' ? 'deep' : 'fast',
    })
    if (result.kind === 'failed') {
      return sendJson(reply, failedStatus(result.code), { ...result, traceId })
    }
    if (result.kind === 'direct') {
      return sendJson(reply, 200, { kind: 'direct', text: result.text, traceId })
    }
    return sendJson(reply, 200, {
      kind: 'authors',
      normalizedQuestion: result.normalizedQuestion,
      authors: result.authors.map((item) => ({
        authorId: item.authorId,
        displayName: item.authorName,
        authorName: item.authorName,
        evidenceId: item.evidenceId,
        evidenceSummary: item.evidenceSummary,
        evidenceUrl: item.evidenceUrl,
        sourceUrl: item.evidenceUrl,
        bio: '知乎作者',
        reason: item.displayText,
        displayText: item.displayText,
        origin: 'zhihu',
      })),
      traceId,
    })
  })

  app.post('/api/authors/search', async (request: FastifyRequest, reply: FastifyReply) => {
    const traceId = String(request.headers['x-trace-id'] ?? `n-${Date.now()}`)
    if (!ports.ready || !ports.authors) {
      return sendJson(reply, 503, {
        kind: 'failed',
        code: 'CONFIG_INVALID',
        message: 'Required Zhihu or DeepSeek configuration is missing.',
        traceId,
      })
    }
    const body = asRecord(request.body) ?? {}
    const result = await ports.authors.search({
      query: asText(body.query) || asText(body.question),
      thinkingDepth: body.thinkingDepth === 'deep' ? 'deep' : 'fast',
    })
    if (result.kind === 'failed') {
      return sendJson(reply, failedStatus(result.code), { ...result, traceId })
    }
    if (result.kind === 'empty') {
      return sendJson(reply, 200, { kind: 'empty', authors: [], traceId })
    }
    return sendJson(reply, 200, {
      kind: 'results',
      authors: result.authors.map((item) => ({
        authorId: item.authorId,
        displayName: item.authorName,
        authorName: item.authorName,
        origin: item.origin,
        evidenceId: item.evidenceId,
        evidenceSummary: item.evidenceSummary,
        evidenceUrl: item.evidenceUrl,
        sourceUrl: item.evidenceUrl,
        bio: '知乎作者',
      })),
      traceId,
    })
  })

  app.get('/api/authors/network', async (request: FastifyRequest, reply: FastifyReply) => {
    const traceId = String(request.headers['x-trace-id'] ?? `net-${Date.now()}`)
    if (!ports.authors) {
      return sendJson(reply, 503, {
        kind: 'failed',
        code: 'NETWORK_UNAVAILABLE',
        message: '现在连不上博主搜索。请稍后再试。',
        traceId,
      })
    }
    const result = ports.authors.listNetwork()
    if (result.kind === 'failed') {
      return sendJson(reply, 503, { ...result, traceId })
    }
    return sendJson(reply, 200, {
      kind: 'list',
      authors: result.authors,
      traceId,
    })
  })
}
