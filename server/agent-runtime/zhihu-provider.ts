import { createHash } from 'node:crypto'
import { allowedOrigin, type ProviderConfig } from '../config.ts'
import {
  isLiuKanshanName,
  type ClockPort,
  type HttpPort,
} from '../ports.ts'
import { parseZhihuSearchPayload, zhihuDirectUrl, zhihuSearchUrl } from '../zhihu.adapter.ts'
import { ZHIDA_FAST_MODEL } from './constants.ts'
import type {
  ZhihuDirectInput,
  ZhihuDirectResult,
  ZhihuProvider,
  ZhihuSearchHit,
  ZhihuSearchResult,
} from './types.ts'

const OUTPUT_LIMIT = 200_000

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function pick(record: Record<string, unknown> | undefined, ...keys: string[]): unknown {
  if (!record) return undefined
  for (const key of keys) {
    if (key in record) return record[key]
  }
  return undefined
}

export function stableEvidenceId(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 32)
}

function assertAllowed(url: string, origin: string) {
  if (new URL(url).origin !== origin) throw new Error('ssrf')
}

function zhihuHeaders(config: ProviderConfig, clock: ClockPort): Record<string, string> {
  return {
    Authorization: `Bearer ${config.zhihuAccessSecret}`,
    'X-Request-Timestamp': String(clock.unixSeconds()),
    'Content-Type': 'application/json',
  }
}

function mapHits(payload: ReturnType<typeof parseZhihuSearchPayload>): ZhihuSearchResult {
  if (payload.kind !== 'hits') return payload
  const items: ZhihuSearchHit[] = payload.items.map((item) => ({
    evidenceId: stableEvidenceId(item.url),
    authorId: item.authorKey && item.authorName && !isLiuKanshanName(item.authorName) ? item.authorKey : null,
    authorName: item.authorName && !isLiuKanshanName(item.authorName) ? item.authorName : null,
    title: item.title,
    summary: item.excerpt,
    url: item.url,
  }))
  return items.length > 0 ? { kind: 'hits', items } : { kind: 'empty' }
}

export function createAgentZhihuProvider(ports: {
  config: ProviderConfig
  http: HttpPort
  clock: ClockPort
}): ZhihuProvider {
  const origin = allowedOrigin(ports.config.zhihuApiBaseUrl)
  return {
    async search(query, count, signal): Promise<ZhihuSearchResult> {
      const q = query.trim()
      if (!q) return { kind: 'empty' }
      const url = zhihuSearchUrl(ports.config.zhihuApiBaseUrl, q, count)
      try {
        assertAllowed(url, origin)
        const response = await ports.http(url, {
          method: 'GET',
          headers: zhihuHeaders(ports.config, ports.clock),
          signal,
        })
        const text = await response.text()
        if (!response.ok) return { kind: 'failed', message: '知乎检索不可用。' }
        let payload: unknown
        try {
          payload = JSON.parse(text) as unknown
        } catch {
          return { kind: 'failed', message: '知乎检索返回了无法解析的响应。' }
        }
        return mapHits(parseZhihuSearchPayload(payload))
      } catch (cause) {
        if (cause instanceof Error && cause.name === 'AbortError') return { kind: 'failed', message: '知乎检索已中止。' }
        return { kind: 'failed', message: '知乎检索不可用。' }
      }
    },

    async direct(input: ZhihuDirectInput): Promise<ZhihuDirectResult> {
      const url = new URL(zhihuDirectUrl(ports.config.zhihuApiBaseUrl))
      try {
        assertAllowed(url.toString(), origin)
        const response = await ports.http(url.toString(), {
          method: 'POST',
          headers: zhihuHeaders(ports.config, ports.clock),
          signal: input.signal,
          body: JSON.stringify({
            model: ZHIDA_FAST_MODEL,
            messages: input.messages,
            ...(input.thinkingDepth === 'deep' ? { thinking: { type: 'enabled' } } : {}),
          }),
        })
        const text = await response.text()
        if (!response.ok) return { kind: 'failed', message: '知乎直答不可用。' }
        let payload: unknown
        try {
          payload = JSON.parse(text) as unknown
        } catch {
          return { kind: 'failed', message: '知乎直答返回了无法解析的响应。' }
        }
        const root = asRecord(payload)
        const choices = pick(root, 'choices', 'Choices')
        const first = Array.isArray(choices) ? asRecord(choices[0]) : undefined
        const message = asRecord(pick(first, 'message', 'Message'))
        const content = asText(pick(message, 'content', 'Content') ?? pick(root, 'answer', 'Answer', 'output', 'Output'))
        if (!content) return { kind: 'failed', message: '知乎直答返回了空内容。' }
        return { kind: 'completed', text: content.slice(0, OUTPUT_LIMIT) }
      } catch (cause) {
        if (cause instanceof Error && cause.name === 'AbortError') return { kind: 'failed', message: '知乎直答已中止。' }
        return { kind: 'failed', message: '知乎直答不可用。' }
      }
    },
  }
}
