import type { SearchMetadata } from '@threadpeak/contracts/search-scope'
export type HttpRequestInit = {
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: string
  signal?: AbortSignal
  timeoutMs?: number
}

export type HttpResponse = {
  ok: boolean
  status: number
  headers?: { get(name:string):string|null }
  text(): Promise<string>
  body?: ReadableStream<Uint8Array> | null
}

export type HttpPort = (url: string, init?: HttpRequestInit) => Promise<HttpResponse>

export type ClockPort = {
  now(): Date
  unixSeconds(): number
}

export type EvidenceHit = SearchMetadata & {
  title: string
  url: string
  excerpt: string
  authorName: string | null
  authorKey: string | null
  authorUrl: string | null
}

export type AuthorCandidate = {
  authorKey: string
  displayName: string
  profileUrl: string
  bio: string
  evidence: readonly EvidenceHit[]
}

export type AuthorCard = {
  authorKey: string
  displayName: string
  profileUrl: string
  bio: string
  reason: string
  origin: 'network' | 'zhihu'
  sourceUrl: string
}

export type ZhihuSearchResult =
  | { kind: 'hits'; items: readonly EvidenceHit[] }
  | { kind: 'empty' }
  | { kind: 'failed'; message: string }

export type ZhihuDirectResult =
  | { kind: 'completed'; text: string }
  | { kind: 'failed'; message: string }

export type ModelResult =
  | { kind: 'completed'; text: string }
  | { kind: 'failed'; message: string }

export type GrowDecisionPayload = {
  kind: 'pred' | 'succ' | 'par'
  title: string
  reason: string
  mergeNodeId: string | null
}

export type ModelStreamEvent =
  | { kind: 'delta'; text: string }
  | { kind: 'completed'; text: string }
  | { kind: 'failed'; message: string }

export type AnswerModelInput = {
  question: string
  topic?: string
  quote?: string
  evidence: readonly EvidenceHit[]
  graphContext?: string
  hostTitle?: string
}

export type ReviewPickResult =
  | { kind: 'selected'; authorKeys: readonly string[]; reasons: Readonly<Record<string, string>> }
  | { kind: 'none' }
  | { kind: 'failed'; message: string }

export type EvidenceSearchProvider = {
  searchContent(query: string, count: number, signal?: AbortSignal): Promise<ZhihuSearchResult>
}

export type ZhihuDirectAnswerProvider = {
  answer(question: string, evidence: readonly EvidenceHit[], signal?: AbortSignal): Promise<ZhihuDirectResult>
}

export type AnswerModelProvider = {
  answer(input: AnswerModelInput, signal?: AbortSignal): Promise<ModelResult>
  answerStream?(input: AnswerModelInput, signal?: AbortSignal): AsyncIterable<ModelStreamEvent>
  classifyGrow?(input: {
    question: string
    quote?: string
    topic?: string
    hostTitle?: string
    graphContext?: string
    candidates: readonly { id: string; kind: 'pred' | 'succ' | 'par'; title: string; questions: readonly string[] }[]
  }, signal?: AbortSignal): Promise<ModelResult>
}

export type AuthorRelevanceReviewProvider = {
  pick(input: { question: string; candidates: readonly AuthorCandidate[]; limit: 2 | 3 }, signal?: AbortSignal): Promise<ReviewPickResult>
}

export type AuthorNetworkPort = {
  searchRelated(query: string, signal?: AbortSignal): Promise<
    | { kind: 'hits'; authors: readonly AuthorCard[] }
    | { kind: 'empty' }
    | { kind: 'failed'; message: string }
  >
}

export const LIU_KANSHAN_NAMES = new Set([
  '刘看山',
  'liu kanshan',
  'liukanshan',
  '知乎直达',
])

export function isLiuKanshanName(value: string | null | undefined): boolean {
  const normalized = value?.trim().toLowerCase() ?? ''
  if (!normalized) return false
  return LIU_KANSHAN_NAMES.has(value?.trim() ?? '') || LIU_KANSHAN_NAMES.has(normalized)
}

export function createUnavailableAuthorNetwork(): AuthorNetworkPort {
  return {
    async searchRelated() {
      return { kind: 'failed', message: '现在连不上博主搜索。请稍后再试。' }
    },
  }
}
