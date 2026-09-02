import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import type { ConfigResolution } from './config.ts'
import type { LiveService } from './live-service.ts'
import type { HttpPort } from './ports.ts'

const MAX_BODY = 64_000
const LISTEN_HOST = '127.0.0.1'
const LISTEN_PORT = 4312

type Json = Record<string, unknown>

function readText(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(new Error('too-large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function send(res: ServerResponse, status: number, body: Json) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

function traceIdOf(req: IncomingMessage): string {
  const header = req.headers['x-trace-id']
  const value = Array.isArray(header) ? header[0] : header
  return value?.trim() || `live-${randomUUID()}`
}

function asRecord(value: unknown): Json | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Json
}

async function readJson(req: IncomingMessage): Promise<Json> {
  const text = await readText(req)
  if (!text.trim()) return {}
  const parsed = JSON.parse(text) as unknown
  return asRecord(parsed) ?? {}
}

async function proxyPathGenerate(req: IncomingMessage, res: ServerResponse, upstream: string, http: HttpPort) {
  const body = await readText(req)
  const target = new URL('/api/paths/generate', `${upstream}/`)
  const forwarded = await http(target.toString(), {
    method: 'POST',
    headers: { 'content-type': req.headers['content-type'] || 'application/json' },
    body,
  })
  const text = await forwarded.text()
  res.writeHead(forwarded.status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(text)
}

export function createLiveServer(ports: {
  config: ConfigResolution
  service?: LiveService
  pathGenerateUpstream?: string
  http: HttpPort
}) {
  return createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${LISTEN_HOST}:${LISTEN_PORT}`)
    const traceId = traceIdOf(req)
    try {
      if (req.method === 'GET' && url.pathname === '/health') {
        send(res, 200, { ok: true })
        return
      }
      if (req.method === 'GET' && (url.pathname === '/ready' || url.pathname === '/api/ready')) {
        if (!ports.config.ok) {
          send(res, 503, {
            ready: false,
            code: 'CONFIG_INVALID',
            message: 'Required Zhihu or DeepSeek configuration is missing.',
            traceId,
          })
          return
        }
        send(res, 200, { ready: true, traceId })
        return
      }
      if (!ports.config.ok || !ports.service) {
        send(res, 503, {
          kind: 'failed',
          code: 'CONFIG_INVALID',
          message: 'Required Zhihu or DeepSeek configuration is missing.',
          traceId,
        })
        return
      }
      if (req.method === 'POST' && url.pathname === '/api/paths/generate') {
        if (!ports.pathGenerateUpstream) {
          send(res, 503, {
            code: 'providers_unavailable',
            message: '路径生成 Provider 尚未启用，请先启动已配置的本地服务。',
            traceId,
          })
          return
        }
        await proxyPathGenerate(req, res, ports.pathGenerateUpstream, ports.http)
        return
      }
      const payload = req.method === 'POST' ? await readJson(req) : {}
      if (req.method === 'POST' && url.pathname === '/api/answers') {
        const result = await ports.service.ordinaryAnswer({
          question: typeof payload.question === 'string' ? payload.question : '',
          ...(typeof payload.topic === 'string' ? { topic: payload.topic } : {}),
          ...(typeof payload.quote === 'string' ? { quote: payload.quote } : {}),
        })
        send(res, result.kind === 'completed' ? 200 : 503, { ...result, traceId })
        return
      }
      if (req.method === 'POST' && url.pathname === '/api/ask-author') {
        const result = await ports.service.askAuthor({
          question: typeof payload.question === 'string' ? payload.question : '',
          quote: typeof payload.quote === 'string' ? payload.quote : '',
        })
        send(res, result.kind === 'failed' ? 503 : 200, { ...result, traceId })
        return
      }
      if (req.method === 'POST' && url.pathname === '/api/authors/search') {
        const result = await ports.service.authorSearch({
          query: typeof payload.query === 'string' ? payload.query : '',
        })
        const status = result.kind === 'failed' ? (result.code === 'NETWORK_UNAVAILABLE' ? 503 : 503) : 200
        send(res, status, { ...result, traceId })
        return
      }
      send(res, 404, { code: 'NOT_FOUND', message: 'Unknown live endpoint.', traceId })
    } catch (cause) {
      const status = cause instanceof Error && cause.message === 'too-large' ? 413 : 500
      send(res, status, {
        kind: 'failed',
        code: 'PROVIDER_UNAVAILABLE',
        message: 'Live request failed before a safe response was available.',
        traceId,
      })
    }
  })
}

export function listenLiveServer(server: ReturnType<typeof createLiveServer>) {
  return new Promise<{ host: string; port: number }>((resolve) => {
    server.listen(LISTEN_PORT, LISTEN_HOST, () => resolve({ host: LISTEN_HOST, port: LISTEN_PORT }))
  })
}
