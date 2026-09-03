import { isLiuKanshanName } from '../ports.ts'
import type {
  A1Output,
  A2Output,
  N1Output,
  N2Output,
} from '../agent-runtime/schemas.ts'
import type {
  AgentFailureCode,
  AuthorCandidate,
  SearchGroup,
  StructuredAgentId,
  StructuredInvokeResult,
  TextInvokeResult,
  ThinkingDepth,
  ZhihuSearchResult,
} from '../agent-runtime/types.ts'
import type { AuthorNetworkProjector, NetworkMember } from './network.ts'

export type AskAuthorCard = {
  authorId: string
  authorName: string
  evidenceId: string
  evidenceSummary: string
  evidenceUrl: string
  displayText: string
}

export type AskAuthorResult =
  | { kind: 'authors'; authors: AskAuthorCard[]; normalizedQuestion: string }
  | { kind: 'direct'; text: string }
  | { kind: 'failed'; code: AgentFailureCode; message: string }

export type AuthorSearchOrigin = 'high-weight' | 'low-weight' | 'zhihu'

export type AuthorSearchHit = {
  authorId: string
  authorName: string
  origin: AuthorSearchOrigin
  evidenceId?: string
  evidenceSummary?: string
  evidenceUrl?: string
}

export type AuthorSearchResult =
  | { kind: 'results'; authors: AuthorSearchHit[] }
  | { kind: 'empty' }
  | { kind: 'failed'; code: AgentFailureCode | 'NETWORK_UNAVAILABLE'; message: string }

export type AuthorNetworkListResult =
  | { kind: 'list'; authors: NetworkMember[] }
  | { kind: 'failed'; code: 'NETWORK_UNAVAILABLE'; message: string }

export type AuthorsInvokeStructured = <T>(
  agentId: StructuredAgentId,
  context: unknown,
  options?: {
    thinkingDepth?: ThinkingDepth
    parseInput?: {
      candidates?: readonly AuthorCandidate[]
      excludedAuthorIds?: readonly string[]
      remainingSlots?: number
    }
  },
) => Promise<StructuredInvokeResult<T>>

export type AuthorsInvokeText = (
  agentId: 'A3',
  context: unknown,
  options?: { thinkingDepth?: ThinkingDepth },
) => Promise<TextInvokeResult>

export type AuthorsSearch = (query: string, count: number) => Promise<ZhihuSearchResult>

const SEARCH_COUNT = 8
const MAX_SEARCH_AUTHORS = 3
const MAX_ASK_AUTHORS = 2

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function fail(code: AgentFailureCode, message: string): { kind: 'failed'; code: AgentFailureCode; message: string } {
  return { kind: 'failed', code, message }
}

function asAuthorCandidate(value: AuthorCandidate): AuthorCandidate {
  return {
    authorId: value.authorId,
    authorName: value.authorName,
    evidence: value.evidence.map((item) => ({
      evidenceId: item.evidenceId,
      summary: item.summary,
      url: item.url,
    })),
  }
}

export function groupAuthorCandidates(
  groups: readonly SearchGroup[],
  excludeAuthorIds: readonly string[] = [],
): AuthorCandidate[] {
  const excluded = new Set(excludeAuthorIds)
  const grouped = new Map<string, { authorId: string; authorName: string; evidence: { evidenceId: string; summary: string; url: string }[] }>()
  for (const group of groups) {
    for (const item of group.results) {
      const authorId = item.authorId?.trim() ?? ''
      const authorName = item.authorName?.trim() ?? ''
      if (!authorId || !authorName) continue
      if (isLiuKanshanName(authorId) || isLiuKanshanName(authorName)) continue
      if (excluded.has(authorId)) continue
      const evidenceId = item.evidenceId.trim()
      const url = item.url.trim()
      const summary = item.summary.trim()
      if (!evidenceId || !url) continue
      const current = grouped.get(authorId)
      const evidence = { evidenceId, summary: summary || item.title.trim() || url, url }
      if (current) {
        if (!current.evidence.some((entry) => entry.evidenceId === evidenceId || entry.url === url)) {
          current.evidence.push(evidence)
        }
        continue
      }
      grouped.set(authorId, { authorId, authorName, evidence: [evidence] })
    }
  }
  return [...grouped.values()].map(asAuthorCandidate)
}

function lookupEvidence(candidate: AuthorCandidate, evidenceId: string) {
  return candidate.evidence.find((item) => item.evidenceId === evidenceId)
}

export function displayAuthorCard(candidate: AuthorCandidate, evidenceId: string): AskAuthorCard | undefined {
  const evidence = lookupEvidence(candidate, evidenceId)
  if (!evidence) return undefined
  return {
    authorId: candidate.authorId,
    authorName: candidate.authorName,
    evidenceId: evidence.evidenceId,
    evidenceSummary: evidence.summary,
    evidenceUrl: evidence.url,
    displayText: `${evidence.summary}\n\n详细内容可以阅读我的文章 ${evidence.url}`,
  }
}

async function searchQueries(
  search: AuthorsSearch,
  queries: readonly { id: string; text: string }[],
): Promise<{ kind: 'groups'; groups: SearchGroup[] } | { kind: 'failed'; message: string }> {
  const searches = await Promise.all(queries.map(async (query) => {
    let result = await search(query.text, SEARCH_COUNT)
    if (result.kind === 'failed') {
      await sleep(400)
      result = await search(query.text, SEARCH_COUNT)
    }
    return { query, result }
  }))
  const hits = searches.filter((item) => item.result.kind === 'hits')
  if (hits.length === 0 && searches.some((item) => item.result.kind === 'failed')) {
    return { kind: 'failed', message: '知乎检索不可用。' }
  }
  return {
    kind: 'groups',
    groups: searches.map(({ query, result }) => ({
      queryId: query.id,
      query: query.text,
      results: result.kind === 'hits'
        ? result.items.map((item) => ({
          evidenceId: item.evidenceId,
          authorId: item.authorId,
          authorName: item.authorName,
          title: item.title,
          summary: item.summary,
          url: item.url,
        }))
        : [],
    })),
  }
}

function memberToHit(member: NetworkMember): AuthorSearchHit {
  return {
    authorId: member.authorId,
    authorName: member.authorName,
    origin: member.weight === 'high' ? 'high-weight' : 'low-weight',
  }
}

export function createAuthorsOrchestrator(ports: {
  invokeStructured: AuthorsInvokeStructured
  invokeText: AuthorsInvokeText
  search: AuthorsSearch
  network: AuthorNetworkProjector
}) {
  const ask = async (input: {
    question: string
    selection: { text: string; anchor?: string }
    host: { nodeId: string; content: string }
    carrier?: { id?: string; title?: string }
    concept?: { id?: string; title?: string }
    thinkingDepth?: ThinkingDepth
  }): Promise<AskAuthorResult> => {
    const question = input.question.trim()
    const selectionText = input.selection.text.trim()
    const hostNodeId = input.host.nodeId.trim()
    if (!question || !selectionText) {
      return fail('PROVIDER_INVALID', '问博主必须先划选原文，再写下问题。')
    }
    if (!hostNodeId) {
      return fail('PROVIDER_INVALID', '问博主需要划选所在的宿主卡片。')
    }
    const thinkingDepth = input.thinkingDepth === 'deep' ? 'deep' : 'fast'
    const a1 = await ports.invokeStructured<A1Output>('A1', {
      question,
      selection: {
        text: selectionText,
        anchor: input.selection.anchor?.trim() || hostNodeId,
      },
      host: {
        nodeId: hostNodeId,
        content: input.host.content,
      },
    }, { thinkingDepth })
    if (a1.kind === 'failed') return fail(a1.code, a1.message)

    const searched = await searchQueries(ports.search, a1.value.queries)
    if (searched.kind === 'failed') return fail('PROVIDER_UNAVAILABLE', '知乎检索不可用，不能完成本次问博主。')
    const candidates = groupAuthorCandidates(searched.groups)

    const a2 = await ports.invokeStructured<A2Output>('A2', {
      question,
      selection: selectionText,
      candidates,
    }, { thinkingDepth, parseInput: { candidates } })
    if (a2.kind === 'failed') return fail(a2.code, a2.message)

    if (a2.value.status === 'no_suitable_author') {
      const a3 = await ports.invokeText('A3', {
        question,
        selection: selectionText,
        selectionSummary: null,
      }, { thinkingDepth })
      if (a3.kind === 'failed') return fail(a3.code, a3.message)
      const text = a3.text.trim()
      if (!text) return fail('OUTPUT_INVALID', '刘看山直答没有返回正文。')
      return { kind: 'direct', text }
    }

    const authors: AskAuthorCard[] = []
    const seen = new Set<string>()
    for (const selection of a2.value.selections) {
      if (seen.has(selection.authorId) || authors.length >= MAX_ASK_AUTHORS) continue
      const candidate = candidates.find((item) => item.authorId === selection.authorId)
      if (!candidate) continue
      const card = displayAuthorCard(candidate, selection.evidenceId)
      if (!card) continue
      authors.push(card)
      seen.add(card.authorId)
      ports.network.writeHigh({
        authorId: card.authorId,
        authorName: card.authorName,
        carrierId: input.carrier?.id?.trim() ?? '',
        carrierTitle: input.carrier?.title?.trim() ?? '',
        conceptId: input.concept?.id?.trim() ?? '',
        conceptTitle: input.concept?.title?.trim() ?? '',
        normalizedQuestion: a2.value.normalizedQuestion,
      })
    }
    if (authors.length === 0) {
      return fail('OUTPUT_INVALID', '问博主没有得到可回查的真实作者证据。')
    }
    return { kind: 'authors', authors, normalizedQuestion: a2.value.normalizedQuestion }
  }

  const searchAuthors = async (input: {
    query: string
    thinkingDepth?: ThinkingDepth
  }): Promise<AuthorSearchResult> => {
    const query = input.query.trim()
    if (!query) return fail('PROVIDER_INVALID', '搜索问题不能为空。')
    if (!ports.network.available) {
      return {
        kind: 'failed',
        code: 'NETWORK_UNAVAILABLE',
        message: '博主网络还没有接通真实的关系投影。',
      }
    }
    const thinkingDepth = input.thinkingDepth === 'deep' ? 'deep' : 'fast'
    const high = ports.network.searchHigh(query, MAX_SEARCH_AUTHORS)
    const remainingAfterHigh = MAX_SEARCH_AUTHORS - high.length
    const low = remainingAfterHigh > 0
      ? ports.network.searchLow(query, high.map((item) => item.authorId), remainingAfterHigh)
      : []
    const fromNetwork = [...high, ...low].map(memberToHit)
    const remainingSlots = MAX_SEARCH_AUTHORS - fromNetwork.length
    if (remainingSlots <= 0) {
      return { kind: 'results', authors: fromNetwork.slice(0, MAX_SEARCH_AUTHORS) }
    }

    const n1 = await ports.invokeStructured<N1Output>('N1', {
      question: query,
      remainingSlots,
    }, { thinkingDepth })
    if (n1.kind === 'failed') return fail(n1.code, n1.message)

    const searched = await searchQueries(ports.search, n1.value.queries)
    if (searched.kind === 'failed') return fail('PROVIDER_UNAVAILABLE', '知乎检索不可用，不能完成本次博主搜索。')
    const excludedAuthorIds = fromNetwork.map((item) => item.authorId)
    const candidates = groupAuthorCandidates(searched.groups, excludedAuthorIds)
    if (candidates.length === 0) {
      return fromNetwork.length > 0
        ? { kind: 'results', authors: fromNetwork }
        : { kind: 'empty' }
    }

    const n2 = await ports.invokeStructured<N2Output>('N2', {
      question: query,
      remainingSlots,
      excludedAuthorIds,
      candidates,
    }, {
      thinkingDepth,
      parseInput: { candidates, excludedAuthorIds, remainingSlots },
    })
    if (n2.kind === 'failed') return fail(n2.code, n2.message)

    const zhihu: AuthorSearchHit[] = []
    const seen = new Set(excludedAuthorIds)
    for (const selection of n2.value.selections) {
      if (zhihu.length >= remainingSlots) break
      if (seen.has(selection.authorId)) continue
      const candidate = candidates.find((item) => item.authorId === selection.authorId)
      if (!candidate) continue
      const evidence = lookupEvidence(candidate, selection.evidenceId)
      if (!evidence) continue
      zhihu.push({
        authorId: candidate.authorId,
        authorName: candidate.authorName,
        origin: 'zhihu',
        evidenceId: evidence.evidenceId,
        evidenceSummary: evidence.summary,
        evidenceUrl: evidence.url,
      })
      seen.add(candidate.authorId)
      ports.network.writeLow({
        authorId: candidate.authorId,
        authorName: candidate.authorName,
        question: query,
      })
    }
    const authors = [...fromNetwork, ...zhihu].slice(0, MAX_SEARCH_AUTHORS)
    return authors.length > 0 ? { kind: 'results', authors } : { kind: 'empty' }
  }

  const listNetwork = (): AuthorNetworkListResult => {
    if (!ports.network.available) {
      return {
        kind: 'failed',
        code: 'NETWORK_UNAVAILABLE',
        message: '博主网络还没有接通真实的关系投影。',
      }
    }
    return { kind: 'list', authors: ports.network.list() }
  }

  return { ask, search: searchAuthors, listNetwork }
}

export type AuthorsOrchestrator = ReturnType<typeof createAuthorsOrchestrator>
