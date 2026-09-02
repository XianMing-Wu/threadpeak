import type {
  AnswerModelProvider,
  AuthorCard,
  AuthorCandidate,
  AuthorNetworkPort,
  AuthorRelevanceReviewProvider,
  EvidenceHit,
  EvidenceSearchProvider,
  ZhihuDirectAnswerProvider,
} from './ports.ts'
import { isLiuKanshanName } from './ports.ts'

export type LiveFailure = {
  kind: 'failed'
  code: 'PROVIDER_UNAVAILABLE' | 'PROVIDER_INVALID' | 'NETWORK_UNAVAILABLE' | 'EMPTY'
  message: string
}

export type OrdinaryAnswerResult =
  | { kind: 'completed'; text: string; evidenceCount: number }
  | LiveFailure

export type AskAuthorResult =
  | { kind: 'authors'; authors: readonly AuthorCard[] }
  | { kind: 'direct'; text: string }
  | LiveFailure

export type AuthorSearchResult =
  | { kind: 'results'; origin: 'network' | 'zhihu'; authors: readonly AuthorCard[] }
  | { kind: 'empty' }
  | LiveFailure

function groupAuthors(items: readonly EvidenceHit[]): AuthorCandidate[] {
  const groups = new Map<string, AuthorCandidate>()
  for (const item of items) {
    if (!item.authorKey || !item.authorName || isLiuKanshanName(item.authorName)) continue
    const current = groups.get(item.authorKey)
    if (current) {
      groups.set(item.authorKey, { ...current, evidence: [...current.evidence, item] })
      continue
    }
    groups.set(item.authorKey, {
      authorKey: item.authorKey,
      displayName: item.authorName,
      profileUrl: item.authorUrl || item.authorKey,
      bio: item.excerpt.slice(0, 80) || '知乎作者',
      evidence: [item],
    })
  }
  return [...groups.values()]
}

function toCards(
  candidates: readonly AuthorCandidate[],
  keys: readonly string[],
  reasons: Readonly<Record<string, string>>,
  origin: 'network' | 'zhihu',
): AuthorCard[] {
  const byKey = new Map(candidates.map((item) => [item.authorKey, item]))
  const cards: AuthorCard[] = []
  for (const key of keys) {
    const candidate = byKey.get(key)
    if (!candidate || isLiuKanshanName(candidate.displayName)) continue
    const source = candidate.evidence[0]
    if (!source) continue
    cards.push({
      authorKey: candidate.authorKey,
      displayName: candidate.displayName,
      profileUrl: candidate.profileUrl,
      bio: candidate.bio,
      reason: reasons[key] || '与当前问题相关的公开内容',
      origin,
      sourceUrl: source.url,
    })
  }
  return cards
}

export function createLiveService(ports: {
  search: EvidenceSearchProvider
  answer: AnswerModelProvider
  review: AuthorRelevanceReviewProvider
  direct: ZhihuDirectAnswerProvider
  network: AuthorNetworkPort
}) {
  return {
    async ordinaryAnswer(input: {
      question: string
      topic?: string
      quote?: string
      signal?: AbortSignal
    }): Promise<OrdinaryAnswerResult> {
      const question = input.question.trim()
      if (!question) return { kind: 'failed', code: 'PROVIDER_INVALID', message: '问题不能为空。' }
      const search = await ports.search.searchContent([input.topic, input.quote, question].filter(Boolean).join(' '), 8, input.signal)
      if (search.kind === 'failed') {
        return { kind: 'failed', code: 'PROVIDER_UNAVAILABLE', message: '知乎检索不可用，不能生成这次回答。' }
      }
      const evidence = search.kind === 'hits' ? search.items : []
      const answered = await ports.answer.answer({
        question,
        evidence,
        ...(input.topic ? { topic: input.topic } : {}),
        ...(input.quote ? { quote: input.quote } : {}),
      }, input.signal)
      if (answered.kind === 'failed') {
        return { kind: 'failed', code: 'PROVIDER_UNAVAILABLE', message: '模型服务不可用，不能生成这次回答。' }
      }
      return { kind: 'completed', text: answered.text, evidenceCount: evidence.length }
    },

    async askAuthor(input: {
      question: string
      quote: string
      signal?: AbortSignal
    }): Promise<AskAuthorResult> {
      const question = input.question.trim()
      const quote = input.quote.trim()
      if (!question || !quote) return { kind: 'failed', code: 'PROVIDER_INVALID', message: '问博主需要原文和问题。' }
      const search = await ports.search.searchContent(`${quote}\n${question}`, 10, input.signal)
      if (search.kind === 'failed') {
        return { kind: 'failed', code: 'PROVIDER_UNAVAILABLE', message: '知乎检索不可用，不能完成本次问博主。' }
      }
      const items = search.kind === 'hits' ? search.items : []
      const candidates = groupAuthors(items)
      if (candidates.length > 0) {
        const review = await ports.review.pick({ question: `${quote}\n${question}`, candidates, limit: 2 }, input.signal)
        if (review.kind === 'failed') {
          return { kind: 'failed', code: 'PROVIDER_UNAVAILABLE', message: '作者评审不可用，不能完成本次问博主。' }
        }
        if (review.kind === 'selected') {
          const authors = toCards(candidates, review.authorKeys, review.reasons, 'zhihu')
          if (authors.length > 0) return { kind: 'authors', authors }
        }
      }
      const direct = await ports.direct.answer(`${quote}\n${question}`, items, input.signal)
      if (direct.kind === 'failed') {
        return { kind: 'failed', code: 'PROVIDER_UNAVAILABLE', message: '没有可信作者，且知乎直达不可用。' }
      }
      return { kind: 'direct', text: direct.text }
    },

    async authorSearch(input: {
      query: string
      signal?: AbortSignal
    }): Promise<AuthorSearchResult> {
      const query = input.query.trim()
      if (!query) return { kind: 'failed', code: 'PROVIDER_INVALID', message: '搜索问题不能为空。' }
      const network = await ports.network.searchRelated(query, input.signal)
      if (network.kind === 'failed') {
        return { kind: 'failed', code: 'NETWORK_UNAVAILABLE', message: network.message }
      }
      if (network.kind === 'hits') {
        const authors = network.authors.filter((item) => !isLiuKanshanName(item.displayName)).slice(0, 3)
        return authors.length > 0
          ? { kind: 'results', origin: 'network', authors }
          : { kind: 'empty' }
      }
      const search = await ports.search.searchContent(query, 10, input.signal)
      if (search.kind === 'failed') {
        return { kind: 'failed', code: 'PROVIDER_UNAVAILABLE', message: '知乎检索不可用，不能完成本次博主搜索。' }
      }
      const candidates = search.kind === 'hits' ? groupAuthors(search.items) : []
      if (candidates.length === 0) return { kind: 'empty' }
      const review = await ports.review.pick({ question: query, candidates, limit: 3 }, input.signal)
      if (review.kind === 'failed') {
        return { kind: 'failed', code: 'PROVIDER_UNAVAILABLE', message: '作者评审不可用，不能完成本次博主搜索。' }
      }
      if (review.kind === 'none') return { kind: 'empty' }
      const authors = toCards(candidates, review.authorKeys, review.reasons, 'zhihu')
      return authors.length > 0 ? { kind: 'results', origin: 'zhihu', authors } : { kind: 'empty' }
    },
  }
}

export type LiveService = ReturnType<typeof createLiveService>
