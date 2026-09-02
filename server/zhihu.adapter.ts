import { allowedOrigin, type ProviderConfig } from './config.ts'
import {
  isLiuKanshanName,
  type ClockPort,
  type EvidenceHit,
  type EvidenceSearchProvider,
  type HttpPort,
  type ZhihuDirectAnswerProvider,
  type ZhihuDirectResult,
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

export function zhihuDirectUrl(baseUrl: string): string {
  return new URL(DIRECT_PATH, `${new URL(baseUrl).origin}/`).toString()
}

function authorKeyOf(name: string, profileUrl: string): string | null {
  if (isLiuKanshanName(name)) return null
  if (profileUrl) return profileUrl
  return null
}

export function parseZhihuSearchPayload(payload: unknown): ZhihuSearchResult {
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
  for (const raw of (Array.isArray(rawItems) ? rawItems : []).slice(0, MAX_ITEMS)) {
    const item = asRecord(raw)
    if (!item) continue
    const author = asRecord(pick(item, 'Author', 'author'))
    const title = asText(pick(item, 'Title', 'title', 'headline'))
    const url = absoluteZhihuUrl(asText(pick(item, 'Url', 'url', 'URL', 'Link', 'link')))
    const excerpt = asText(pick(item, 'ContentText', 'contentText', 'Excerpt', 'excerpt', 'Summary', 'summary', 'Content', 'content')).slice(0, MAX_EXCERPT)
    const authorName = asText(
      pick(item, 'AuthorName', 'author_name', 'authorName')
      ?? pick(author, 'Name', 'name', 'FullName', 'fullName'),
    ) || null
    const profileUrl = absoluteZhihuUrl(asText(
      pick(item, 'AuthorHomepage', 'author_homepage', 'AuthorUrl', 'author_url', 'authorUrl')
      ?? pick(author, 'Homepage', 'homepage', 'Url', 'url'),
    ))
    if (!title || !url) continue
    const safeName = authorName && !isLiuKanshanName(authorName) ? authorName : null
    items.push({
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

export function createZhihuDirectAdapter(ports: {
  config: ProviderConfig
  http: HttpPort
  clock: ClockPort
}): ZhihuDirectAnswerProvider {
  const origin = allowedOrigin(ports.config.zhihuApiBaseUrl)
  return {
    async answer(question, evidence, signal): Promise<ZhihuDirectResult> {
      const url = new URL(zhihuDirectUrl(ports.config.zhihuApiBaseUrl))
      const citations = evidence
        .slice(0, 6)
        .map((item, index) => `${index + 1}. ${item.title} ${item.url}`)
        .join('\n')
      try {
        assertAllowed(url.toString(), origin)
        const response = await ports.http(url.toString(), {
          method: 'POST',
          headers: zhihuHeaders(ports.config, ports.clock),
          signal,
          body: JSON.stringify({
            model: 'zhida-fast-1p5',
            messages: [
              {
                role: 'user',
                content: citations
                  ? `${question.trim()}\n\n公开证据：\n${citations}`
                  : question.trim(),
              },
            ],
          }),
        })
        const text = await response.text()
        if (!response.ok) return { kind: 'failed', message: 'Zhihu direct answer returned a non-success status.' }
        let payload: unknown
        try {
          payload = JSON.parse(text) as unknown
        } catch {
          return { kind: 'failed', message: 'Zhihu direct answer returned invalid JSON.' }
        }
        const root = asRecord(payload)
        const choices = pick(root, 'choices', 'Choices')
        const first = Array.isArray(choices) ? asRecord(choices[0]) : undefined
        const message = asRecord(pick(first, 'message', 'Message'))
        const content = asText(pick(message, 'content', 'Content') ?? pick(root, 'answer', 'Answer', 'output', 'Output'))
        if (!content) return { kind: 'failed', message: 'Zhihu direct answer returned an empty body.' }
        return { kind: 'completed', text: content }
      } catch (cause) {
        if (cause instanceof Error && cause.name === 'AbortError') return { kind: 'failed', message: 'Zhihu direct answer was aborted.' }
        return { kind: 'failed', message: 'Zhihu direct answer is unavailable.' }
      }
    },
  }
}
