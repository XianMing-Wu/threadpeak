import { allowedOrigin, type ProviderConfig } from './config.ts'
import {
  isLiuKanshanName,
  type ClockPort,
  type EvidenceHit,
  type EvidenceSearchProvider,
  type HttpPort,
  type ZhihuSearchResult,
} from './ports.ts'

const SEARCH_PATH = 'content/zhihu_search'
const SEARCH_ABSOLUTE_PATH = '/api/v1/content/zhihu_search'
const DIRECT_PATH = '/v1/chat/completions'
const MAX_QUERY = 200
const MAX_ITEMS = 10
const MAX_EXCERPT = 2000

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

function isZhihuUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && (url.hostname === 'zhihu.com' || url.hostname.endsWith('.zhihu.com'))
  } catch {
    return false
  }
}

function absoluteZhihuUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (isZhihuUrl(trimmed)) return trimmed
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    const resolved = `https://www.zhihu.com${trimmed}`
    return isZhihuUrl(resolved) ? resolved : ''
  }
  return ''
}

export function zhihuSearchUrl(baseUrl: string, query: string, count: number): string {
  const base = baseUrl.replace(/\/+$/, '')
  const url = base.endsWith('/api/v1')
    ? new URL(SEARCH_PATH, `${base}/`)
    : new URL(SEARCH_ABSOLUTE_PATH, `${base}/`)
  url.searchParams.set('Query', query)
  url.searchParams.set('Count', String(Math.min(MAX_ITEMS, Math.max(1, count))))
  return url.toString()
}



function authorKeyOf(name: string, profileUrl: string): string | null {
  if (isLiuKanshanName(name)) return null
  return profileUrl || null
}

export function globalSearchUrl(baseUrl: string, query: string, count: number): string {
  const url = new URL('/api/v1/content/global_search', baseUrl)
  url.searchParams.set('Query', query)
  url.searchParams.set('Count', String(Math.min(20, Math.max(1, count))))
  url.searchParams.set('SearchDB', 'all')
  return url.href
}
function safeWebUrl(raw: string): string {
  try { const u=new URL(raw); return u.protocol==='https:'&&!u.username&&!u.password ? u.href : '' } catch { return '' }
}
export function parseZhihuSearchPayload(payload: unknown, source: 'zhihu'|'web' = 'zhihu'): ZhihuSearchResult {
  const root = asRecord(payload)
  if (!root) return { kind: 'failed', message: 'Zhihu search returned a non-object body.' }
  const code = pick(root, 'Code', 'code')
  if (code !== undefined && Number(code) !== 0) {
    return { kind: 'failed', message: `Zhihu search returned Code ${String(code)}.` }
  }
  const data = asRecord(pick(root, 'Data', 'data')) ?? root
  const rawItems = pick(data, 'Items', 'items')
  if (rawItems !== undefined && !Array.isArray(rawItems)) {
    return { kind: 'failed', message: 'Zhihu search Items was not an array.' }
  }
  const items: EvidenceHit[] = []
  for (const raw of (Array.isArray(rawItems) ? rawItems : [])) {
    const item = asRecord(raw)
    if (!item) continue
    const author = asRecord(pick(item, 'Author', 'author'))
    const title = asText(pick(item, 'Title', 'title', 'headline'))
    const url = (source==='zhihu'?absoluteZhihuUrl:safeWebUrl)(asText(pick(item, 'Url', 'url', 'URL', 'Link', 'link')))
    const excerpt = asText(pick(item, 'ContentText', 'contentText', 'Excerpt', 'excerpt', 'Summary', 'summary', 'Content', 'content'))
    const authorName = asText(
      pick(item, 'AuthorName', 'author_name', 'authorName')
      ?? pick(author, 'Name', 'name', 'FullName', 'fullName'),
    ) || null
    const profileUrl = absoluteZhihuUrl(asText(
      pick(item, 'AuthorHomepage', 'author_homepage', 'AuthorUrl', 'author_url', 'authorUrl')
      ?? pick(author, 'Homepage', 'homepage', 'Url', 'url'),
    ))
    if (!title || !url) continue
    const safeName = source==='zhihu' && authorName && !isLiuKanshanName(authorName) ? authorName : null
    const avatar=asText(pick(item,'AuthorAvatar')),badge=asText(pick(item,'AuthorBadgeText')),likes=pick(item,'VoteUpCount')
    const number=(key:string)=>typeof item[key]==='number'&&Number.isFinite(item[key])&&Number(item[key])>=0?Number(item[key]):undefined
    const badgeIcon=asText(item.AuthorBadge)
    items.push({
      sourceKind:source,site:new URL(url).hostname,
      contentType:asText(item.ContentType)||undefined,contentId:asText(item.ContentID)||undefined,
      commentCount:number('CommentCount'),editedAt:number('EditTime'),rankingScore:number('RankingScore'),
      authorityLevel:asText(item.AuthorityLevel)||undefined,
      comments:Array.isArray(item.CommentInfoList)?item.CommentInfoList.map(c=>asText(asRecord(c)?.Content)).filter(Boolean):undefined,
      authorSignature:source==='zhihu'?asText(item.AuthorSignature)||undefined:undefined,
      ...(source==='zhihu'&&/^https:\/\/[^/]+\.zhimg\.com\//.test(badgeIcon)?{badgeIcon}:{}),
      ...(source==='zhihu'&&/^https:\/\/[^/]+\.zhimg\.com\//.test(avatar)?{avatar}:{}),...(source==='zhihu'&&badge?{badge}:{}),...(typeof likes==='number'&&Number.isFinite(likes)?{likes:Math.max(0,likes)}:{}),
      title,
      url,
      excerpt,
      authorName: safeName,
      authorUrl: safeName ? profileUrl || null : null,
      authorKey: safeName ? authorKeyOf(safeName, profileUrl) : null,
    })
  }
  return items.length > 0 ? { kind: 'hits', items } : { kind: 'empty' }
}

function zhihuHeaders(config: ProviderConfig, clock: ClockPort): Record<string, string> {
  return {
    Authorization: `Bearer ${config.zhihuAccessSecret}`,
    'X-Request-Timestamp': String(clock.unixSeconds()),
    'Content-Type': 'application/json',
  }
}

function assertAllowed(url: string, origin: string) {
  if (new URL(url).origin !== origin) {
    throw new Error('ssrf')
  }
}

export function createZhihuSearchAdapter(ports: {
  config: ProviderConfig
  http: HttpPort
  clock: ClockPort
}): EvidenceSearchProvider {
  const origin = allowedOrigin(ports.config.zhihuApiBaseUrl)
  return {
    async searchContent(query, count, signal): Promise<ZhihuSearchResult> {
      const q = query.trim().slice(0, MAX_QUERY)
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
        if (!response.ok) {
          process.stderr.write(`threadpeak-live zhihu-search status=${response.status}\n`)
          return { kind: 'failed', message: `Zhihu search returned HTTP ${response.status}.` }
        }
        let payload: unknown
        try {
          payload = JSON.parse(text) as unknown
        } catch {
          return { kind: 'failed', message: 'Zhihu search returned invalid JSON.' }
        }
        return parseZhihuSearchPayload(payload)
      } catch (cause) {
        if (cause instanceof Error && cause.name === 'AbortError') return { kind: 'failed', message: 'Zhihu search was aborted.' }
        return { kind: 'failed', message: 'Zhihu search is unavailable.' }
      }
    },
  }
}
