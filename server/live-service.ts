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
      graphContext?: string
      hostTitle?: string
      signal?: AbortSignal
    }): Promise<OrdinaryAnswerResult> {
      const question = input.question.trim() || input.quote?.trim() || ''
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
        ...(input.graphContext ? { graphContext: input.graphContext } : {}),
        ...(input.hostTitle ? { hostTitle: input.hostTitle } : {}),
      }, input.signal)
      if (answered.kind === 'failed') {
        return { kind: 'failed', code: 'PROVIDER_UNAVAILABLE', message: '模型服务不可用，不能生成这次回答。' }
      }
      return { kind: 'completed', text: answered.text.slice(0, 200_000), evidenceCount: evidence.length }
    },

    async *ordinaryAnswerStream(input: {
      question: string
      topic?: string
      quote?: string
      graphContext?: string
      hostTitle?: string
      candidates?: readonly { id: string; kind: 'pred' | 'succ' | 'par'; title: string; questions: readonly string[] }[]
      signal?: AbortSignal
    }): AsyncGenerator<
      | { kind: 'status'; stage: 'search' | 'classify' | 'compose' }
      | { kind: 'grow'; grow: { kind: 'pred' | 'succ' | 'par'; title: string; reason: string; mergeNodeId: string | null } }
      | { kind: 'delta'; text: string }
      | { kind: 'completed'; text: string; evidenceCount: number }
      | LiveFailure
    > {
      const question = input.question.trim() || input.quote?.trim() || ''
      if (!question) {
        yield { kind: 'failed', code: 'PROVIDER_INVALID', message: '问题不能为空。' }
        return
      }
      yield { kind: 'status', stage: 'search' }
      const search = await ports.search.searchContent([input.topic, input.quote, question].filter(Boolean).join(' '), 8, input.signal)
      if (search.kind === 'failed') {
        yield { kind: 'failed', code: 'PROVIDER_UNAVAILABLE', message: '知乎检索不可用，不能生成这次回答。' }
        return
      }
      const evidence = search.kind === 'hits' ? search.items : []
      if (ports.answer.classifyGrow && input.candidates) {
        yield { kind: 'status', stage: 'classify' }
        const classified = await ports.answer.classifyGrow({
          question,
          candidates: input.candidates,
          ...(input.quote ? { quote: input.quote } : {}),
          ...(input.topic ? { topic: input.topic } : {}),
          ...(input.hostTitle ? { hostTitle: input.hostTitle } : {}),
          ...(input.graphContext ? { graphContext: input.graphContext } : {}),
        }, input.signal)
        if (classified.kind === 'completed') {
          const match = classified.text.match(/\{[\s\S]*\}/)
          if (match) {
            try {
              const parsed = JSON.parse(match[0]) as {
                kind?: string
                title?: string
                reason?: string
                mergeNodeId?: string | null
              }
              const growKind = parsed.kind === 'pred' || parsed.kind === 'succ' || parsed.kind === 'par' ? parsed.kind : undefined
              if (growKind) {
                yield {
                  kind: 'grow',
                  grow: {
                    kind: growKind,
                    title: typeof parsed.title === 'string' ? parsed.title : '',
                    reason: typeof parsed.reason === 'string' ? parsed.reason : '',
                    mergeNodeId: typeof parsed.mergeNodeId === 'string' ? parsed.mergeNodeId : null,
                  },
                }
              }
            } catch {
              /* classification is optional; answering still proceeds */
            }
          }
        }
      }
      yield { kind: 'status', stage: 'compose' }
      const payload = {
        question,
        evidence,
        ...(input.topic ? { topic: input.topic } : {}),
        ...(input.quote ? { quote: input.quote } : {}),
        ...(input.graphContext ? { graphContext: input.graphContext } : {}),
        ...(input.hostTitle ? { hostTitle: input.hostTitle } : {}),
      }
      if (!ports.answer.answerStream) {
        const answered = await ports.answer.answer(payload, input.signal)
        if (answered.kind === 'failed') {
          yield { kind: 'failed', code: 'PROVIDER_UNAVAILABLE', message: '模型服务不可用，不能生成这次回答。' }
          return
        }
        yield { kind: 'completed', text: answered.text.slice(0, 200_000), evidenceCount: evidence.length }
        return
      }
      let full = ''
      for await (const event of ports.answer.answerStream(payload, input.signal)) {
        if (event.kind === 'delta') {
          if (full.length >= 200_000) continue
          const chunk = event.text.slice(0, Math.max(0, 200_000 - full.length))
          if (!chunk) continue
          full += chunk
          yield { kind: 'delta', text: chunk }
          continue
        }
        if (event.kind === 'failed') {
          yield { kind: 'failed', code: 'PROVIDER_UNAVAILABLE', message: '模型服务不可用，不能生成这次回答。' }
          return
        }
        yield { kind: 'completed', text: event.text.slice(0, 200_000), evidenceCount: evidence.length }
        return
      }
      if (full.trim()) {
        yield { kind: 'completed', text: full.trim().slice(0, 200_000), evidenceCount: evidence.length }
        return
      }
      yield { kind: 'failed', code: 'PROVIDER_UNAVAILABLE', message: '模型服务不可用，不能生成这次回答。' }
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
