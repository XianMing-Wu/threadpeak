import { isLiuKanshanName } from '../ports.ts'

export type NetworkWeight = 'high' | 'low'

export type HighWeightRecord = {
  authorId: string
  authorName: string
  carrierId: string
  carrierTitle: string
  conceptId: string
  conceptTitle: string
  normalizedQuestion: string
}

export type LowWeightRecord = {
  authorId: string
  authorName: string
  question: string
}

export type NetworkMember = {
  authorId: string
  authorName: string
  weight: NetworkWeight
  carrierId?: string
  carrierTitle?: string
  conceptId?: string
  conceptTitle?: string
  question: string
}

export type AuthorNetworkProjector = {
  available: boolean
  list(): NetworkMember[]
  searchHigh(query: string, limit: number): NetworkMember[]
  searchLow(query: string, excludeAuthorIds: readonly string[], limit: number): NetworkMember[]
  writeHigh(record: HighWeightRecord): void
  writeLow(record: LowWeightRecord): void
}

function tokens(text: string): string[] {
  return text.toLowerCase().match(/[\u4e00-\u9fff]|[a-z0-9]+/g) ?? []
}

function relatedScore(query: string, stored: string): number {
  const asked = new Set(tokens(query))
  if (asked.size === 0) return 0
  let hits = 0
  for (const token of tokens(stored)) {
    if (asked.has(token)) hits += 1
  }
  return hits
}

function usable(authorId: string, authorName: string): boolean {
  const id = authorId.trim()
  const name = authorName.trim()
  if (!id || !name) return false
  return !isLiuKanshanName(id) && !isLiuKanshanName(name)
}

function rankRelated(query: string, items: readonly NetworkMember[], exclude: ReadonlySet<string>, limit: number): NetworkMember[] {
  return items
    .filter((item) => !exclude.has(item.authorId) && relatedScore(query, item.question) > 0)
    .sort((left, right) => relatedScore(query, right.question) - relatedScore(query, left.question))
    .slice(0, Math.max(0, limit))
}

export function createUnavailableAuthorNetworkProjector(): AuthorNetworkProjector {
  return {
    available: false,
    list() { return [] },
    searchHigh() { return [] },
    searchLow() { return [] },
    writeHigh() {},
    writeLow() {},
  }
}

export function createInMemoryAuthorNetworkProjector(): AuthorNetworkProjector {
  const high = new Map<string, HighWeightRecord>()
  const low = new Map<string, LowWeightRecord>()

  const asHigh = (record: HighWeightRecord): NetworkMember => ({
    authorId: record.authorId,
    authorName: record.authorName,
    weight: 'high',
    carrierId: record.carrierId,
    carrierTitle: record.carrierTitle,
    conceptId: record.conceptId,
    conceptTitle: record.conceptTitle,
    question: record.normalizedQuestion,
  })

  const asLow = (record: LowWeightRecord): NetworkMember => ({
    authorId: record.authorId,
    authorName: record.authorName,
    weight: 'low',
    question: record.question,
  })

  return {
    available: true,
    list() {
      const members: NetworkMember[] = []
      const seen = new Set<string>()
      for (const record of high.values()) {
        members.push(asHigh(record))
        seen.add(record.authorId)
      }
      for (const record of low.values()) {
        if (seen.has(record.authorId)) continue
        members.push(asLow(record))
        seen.add(record.authorId)
      }
      return members
    },
    searchHigh(query, limit) {
      return rankRelated(query, [...high.values()].map(asHigh), new Set(), limit)
    },
    searchLow(query, excludeAuthorIds, limit) {
      return rankRelated(query, [...low.values()].map(asLow), new Set(excludeAuthorIds), limit)
    },
    writeHigh(record) {
      if (!usable(record.authorId, record.authorName)) return
      high.set(record.authorId, {
        authorId: record.authorId.trim(),
        authorName: record.authorName.trim(),
        carrierId: record.carrierId.trim(),
        carrierTitle: record.carrierTitle.trim(),
        conceptId: record.conceptId.trim(),
        conceptTitle: record.conceptTitle.trim(),
        normalizedQuestion: record.normalizedQuestion.trim(),
      })
    },
    writeLow(record) {
      if (!usable(record.authorId, record.authorName)) return
      low.set(record.authorId, {
        authorId: record.authorId.trim(),
        authorName: record.authorName.trim(),
        question: record.question.trim(),
      })
    },
  }
}
