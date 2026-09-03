import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { FollowUpAnnotation, FollowUpGraphEdge, FollowUpGraphNode, FollowUpMessage, FollowUpOrchestrator } from './orchestrator.ts'

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function asText(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function annotationsOf(value: unknown): FollowUpAnnotation[] {
  if (!Array.isArray(value)) return []
  const items: FollowUpAnnotation[] = []
  for (const item of value) {
    const record = asRecord(item)
    if (!record || typeof record.annotationId !== 'string' || typeof record.content !== 'string') continue
    const type = record.type === 'liu_kanshan_direct'
      ? 'liu_kanshan_direct' as const
      : record.type === 'author_comment'
        ? 'author_comment' as const
        : undefined
    if (!type) continue
    items.push({
      annotationId: record.annotationId,
      type,
      content: record.content,
      authorId: typeof record.authorId === 'string' ? record.authorId : null,
      ...(Array.isArray(record.evidenceIds)
        ? { evidenceIds: record.evidenceIds.filter((id): id is string => typeof id === 'string') }
        : {}),
    })
  }
  return items
}

function nodeOf(value: unknown): FollowUpGraphNode | undefined {
  const record = asRecord(value)
  if (!record || typeof record.nodeId !== 'string' || !record.nodeId.trim()) return undefined
  if (typeof record.title !== 'string' || typeof record.content !== 'string') return undefined
  return {
    nodeId: record.nodeId,
    title: record.title,
    content: record.content,
    annotations: annotationsOf(record.annotations),
  }
}

function nodesOf(value: unknown): FollowUpGraphNode[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const node = nodeOf(item)
    return node ? [node] : []
  })
}

function edgesOf(value: unknown): FollowUpGraphEdge[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const record = asRecord(item)
    if (
      !record
      || typeof record.edgeId !== 'string'
      || typeof record.fromNodeId !== 'string'
      || typeof record.toNodeId !== 'string'
      || typeof record.explanation !== 'string'
    ) return []
    return [{
      edgeId: record.edgeId,
      fromNodeId: record.fromNodeId,
      toNodeId: record.toNodeId,
      explanation: record.explanation,
    }]
  })
}

function messagesOf(value: unknown): FollowUpMessage[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const record = asRecord(item)
    if (!record || typeof record.messageId !== 'string' || typeof record.content !== 'string') return []
    if (record.role !== 'user' && record.role !== 'assistant') return []
    return [{
      messageId: record.messageId,
      role: record.role,
      content: record.content,
      annotations: annotationsOf(record.annotations),
    }]
  })
}

function quoteOf(value: unknown) {
  const record = asRecord(value)
  if (!record) return undefined
  return {
    nodeId: typeof record.nodeId === 'string' ? record.nodeId : null,
    text: typeof record.text === 'string' ? record.text : null,
    messageId: typeof record.messageId === 'string' ? record.messageId : null,
  }
}

export function registerFollowUpRoutes(app: FastifyInstance, ports: {
  followUp?: FollowUpOrchestrator
  ready: boolean
}) {
  app.post('/api/learning/follow-up', async (request: FastifyRequest, reply: FastifyReply) => {
    const traceId = String(request.headers['x-trace-id'] ?? `g-${Date.now()}`)
    if (!ports.ready || !ports.followUp) {
      return reply.code(503).type('application/json; charset=utf-8').send({
        kind: 'failed',
        code: 'CONFIG_INVALID',
        message: 'Required Zhihu or DeepSeek configuration is missing.',
        traceId,
      })
    }
    const body = asRecord(request.body) ?? {}
    const neighborhood = asRecord(body.neighborhood)
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
      write({ kind: 'status', stage: 'running' })
      const result = await ports.followUp.ask({
        routeId: asText(body.routeId),
        conceptId: asText(body.conceptId),
        conversationId: asText(body.conversationId),
        question: asText(body.question),
        hostNodeId: asText(body.hostNodeId),
        quote: quoteOf(body.quote),
        neighborhood: {
          host: nodeOf(neighborhood?.host),
          siblings: nodesOf(neighborhood?.siblings),
          predecessors: nodesOf(neighborhood?.predecessors),
          successors: nodesOf(neighborhood?.successors),
          edges: edgesOf(neighborhood?.edges),
        },
        messages: messagesOf(body.messages),
        thinkingDepth: body.thinkingDepth === 'deep' ? 'deep' : 'fast',
        onText: (text) => write({ kind: 'delta', text }),
      })
      if (result.kind !== 'completed') {
        write({ kind: 'failed', code: result.code, message: result.message })
        reply.raw.end()
        return
      }
      write({
        kind: 'completed',
        text: result.text,
        hostNodeId: result.hostNodeId,
        grow: result.grow,
      })
    } catch {
      write({ kind: 'failed', code: 'PROVIDER_UNAVAILABLE', message: '这次追问没有完成。' })
    }
    reply.raw.end()
  })
}
