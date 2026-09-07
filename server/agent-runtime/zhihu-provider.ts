import { createHash } from 'node:crypto'
import { allowedOrigin, type ProviderConfig } from '../config.ts'
import {
  isLiuKanshanName,
  type ClockPort,
  type HttpPort,
} from '../ports.ts'
import { parseZhihuSearchPayload, zhihuDirectUrl, zhihuSearchUrl, globalSearchUrl } from '../zhihu.adapter.ts'
import { zhidaModelFor } from './constants.ts'
import { providerDiagnostic,parseProviderError,classifyProviderError,readUsage } from './provider-metadata.ts'
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

/** Official people URL when present; otherwise one id per article evidence. Never a display name. */
export function resolveSearchAuthorId(officialId: string | null | undefined, evidenceId: string): string {
  const official = officialId?.trim() ?? ''
  return official || `author-ev-${evidenceId}`
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
    authorName: item.authorName && !isLiuKanshanName(item.authorName) ? item.authorName : null,
    authorId: item.authorName && !isLiuKanshanName(item.authorName)
      ? resolveSearchAuthorId(item.authorKey, stableEvidenceId(item.url))
      : null,
    authorUrl: item.authorUrl,
    ...Object.fromEntries(Object.entries(item).filter(([key,value])=>value!==undefined&&!['authorKey','excerpt','authorName','authorUrl','title','url'].includes(key))),
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
  async function search(query:string,count:number,signal:AbortSignal|undefined,source:'zhihu'|'web'):Promise<ZhihuSearchResult> {
      const q = query.trim()
      if (!q) return { kind: 'empty' }
      const url = (source==='zhihu'?zhihuSearchUrl:globalSearchUrl)(ports.config.zhihuApiBaseUrl, q, count)
      try {
        assertAllowed(url, origin)
        const response = await ports.http(url, {
          method: 'GET',
          headers: zhihuHeaders(ports.config, ports.clock),
          signal,
        })
        const text = await response.text()
        if (!response.ok) {
          const diagnostic=providerDiagnostic(response.status,parseProviderError(text),response.headers)
          return {kind:'failed',message:'知乎检索暂时不可用。',...classifyProviderError(response.status,diagnostic.upstreamCode,true),diagnostic}
        }
        let payload: unknown
        try {
          payload = JSON.parse(text) as unknown
        } catch {
          return { kind: 'failed', message: '知乎检索返回了无法解析的响应。' }
        }
        const diagnostic=providerDiagnostic(response.status,payload,response.headers)
        if(diagnostic.upstreamCode&&diagnostic.upstreamCode!=='0')return {kind:'failed',message:'知乎检索未完成。',...classifyProviderError(response.status,diagnostic.upstreamCode,true),diagnostic}
        return {...mapHits(parseZhihuSearchPayload(payload,source)),diagnostic}
      } catch (cause) {
        if (cause instanceof Error && cause.name === 'AbortError') return { kind: 'failed', message: '知乎检索已中止。' }
        return { kind: 'failed', message: '知乎检索不可用。' }
      }
    }
  return {
    search:(query,count,signal)=>search(query,count,signal,'zhihu'),
    globalSearch:(query,count,signal)=>search(query,count,signal,'web'),
    async direct(input: ZhihuDirectInput): Promise<ZhihuDirectResult> {
      const url = new URL(zhihuDirectUrl(ports.config.zhihuApiBaseUrl))
      try {
        assertAllowed(url.toString(), origin)
        const body = JSON.stringify({
          model: zhidaModelFor(input.thinkingDepth),
          messages: input.messages,
          stream:false,
        })
        {
          const response = await ports.http(url.toString(), {
            method: 'POST',
            headers: zhihuHeaders(ports.config, ports.clock),
            signal: input.signal,
            body,
          })
          const text = await response.text()
          if (!response.ok) {
            const diagnostic=providerDiagnostic(response.status,parseProviderError(text),response.headers)
            return {kind:'failed',message:'知乎直答未完成。',...classifyProviderError(response.status,diagnostic.upstreamCode,true),diagnostic}
          }
          let payload: unknown
          try {
            payload = JSON.parse(text) as unknown
          } catch {
            return { kind: 'failed', message: '知乎直答返回了无法解析的响应。' }
          }
          const root = asRecord(payload)
          const diagnostic=providerDiagnostic(response.status,payload,response.headers)
          if(root?.error)return {kind:'failed',message:'知乎直答未完成。',...classifyProviderError(response.status,diagnostic.upstreamCode,true),diagnostic}
          const choices = pick(root, 'choices', 'Choices')
          const first = Array.isArray(choices) ? asRecord(choices[0]) : undefined
          const message = asRecord(pick(first, 'message', 'Message'))
          const content = asText(pick(message, 'content', 'Content') ?? pick(root, 'answer', 'Answer', 'output', 'Output'))
          if (!content) return { kind: 'failed', message: '知乎直答返回了空内容。' }
          if (content.length > OUTPUT_LIMIT) return { kind: 'failed', message: '知乎直答内容未完整接收。' }
          const finish = pick(first, 'finish_reason', 'FinishReason')
          if (finish && finish !== 'stop') return { kind: 'failed', message: '知乎直答尚未完整完成。' }
          input.signal?.throwIfAborted()
          return { kind: 'completed', text: content,cacheable:finish==='stop',diagnostic,usage:readUsage(root?.usage) }
        }
      } catch (cause) {
        if (cause instanceof Error && cause.name === 'AbortError') return { kind: 'failed', message: '知乎直答已中止。' }
        return { kind: 'failed', message: '知乎直答不可用。' }
      }
    },
  }
}
