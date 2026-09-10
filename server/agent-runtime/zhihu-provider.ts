import { createHash } from 'node:crypto'
import { allowedOrigin, type ProviderConfig } from '../config.ts'
import {
  isLiuKanshanName,
  type ClockPort,
  type HttpPort,
} from '../ports.ts'
import { parseZhihuSearchPayload, zhihuSearchUrl, globalSearchUrl } from '../zhihu.adapter.ts'
import { providerDiagnostic,parseProviderError,classifyProviderError } from './provider-metadata.ts'
import type {
  ZhihuProvider,
  ZhihuSearchHit,
  ZhihuSearchResult,
  ProviderDiagnostic,
} from './types.ts'

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

function transportFailure(cause:unknown,signal?:AbortSignal,diagnostic?:ProviderDiagnostic) {
  const error=cause as {name?:string;code?:unknown;cause?:{code?:unknown}}
  const raw=error?.cause?.code??error?.code
  const transportCode=typeof raw==='string'&&/^[A-Z0-9_]{2,60}$/.test(raw)?raw:undefined
  const code=signal?.aborted?'CANCELLED':error?.name==='TimeoutError'||transportCode==='UND_ERR_CONNECT_TIMEOUT'?'ZHIHU_TIMEOUT':'ZHIHU_NETWORK_UNAVAILABLE'
  return {kind:'failed' as const,code,retryable:code!=='CANCELLED',message:code==='CANCELLED'?'知乎请求已中止。':code==='ZHIHU_TIMEOUT'?'知乎请求超时。':'知乎连接暂时不可用。',diagnostic:{...diagnostic,transportCode}}
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
      let received:ProviderDiagnostic|undefined
      try {
        assertAllowed(url, origin)
        const response = await ports.http(url, {
          method: 'GET',
          headers: zhihuHeaders(ports.config, ports.clock),
          signal,
        })
        received=providerDiagnostic(response.status,undefined,response.headers)
        const text = await response.text()
        if (!response.ok) {
          const diagnostic=providerDiagnostic(response.status,parseProviderError(text),response.headers)
          return {kind:'failed',message:'知乎检索暂时不可用。',...classifyProviderError(response.status,diagnostic.upstreamCode,true),diagnostic}
        }
        let payload: unknown
        try {
          payload = JSON.parse(text) as unknown
        } catch {
          return { kind: 'failed', code:'ZHIHU_INVALID_JSON',retryable:true,diagnostic:received,message: '知乎检索返回了无法解析的响应。' }
        }
        const diagnostic=providerDiagnostic(response.status,payload,response.headers)
        if(diagnostic.upstreamCode&&diagnostic.upstreamCode!=='0')return {kind:'failed',message:'知乎检索未完成。',...classifyProviderError(response.status,diagnostic.upstreamCode,true),diagnostic}
        return {...mapHits(parseZhihuSearchPayload(payload,source)),diagnostic}
      } catch (cause) {
        return transportFailure(cause,signal,received)
      }
    }
  return {
    search:(query,count,signal)=>search(query,count,signal,'zhihu'),
    globalSearch:(query,count,signal)=>search(query,count,signal,'web'),
  }
}
