import {
  authorsAt,
  childrenOf,
  hostsOfAuthor,
  parentsOf,
  type AuthorNetworkEdge,
  type AuthorNetworkKind,
  type AuthorNetworkStore,
} from './author-network'

/** Isolated prototype retriever. Product `#authors` search must not compose this into user-request success. */

export type GraphRagMode = 'local' | 'global' | 'hybrid'

export type GraphRagStage = 'idle' | 'extracting' | 'retrieving' | 'expanding' | 'ranking' | 'ready' | 'empty'

export type GraphRagKeywords = {
  query: string
  highLevel: string[]
  lowLevel: string[]
}

export type GraphRagEntity = {
  id: string
  kind: AuthorNetworkKind
  label: string
  score: number
}

export type GraphRagPathNode = {
  id: string
  kind: AuthorNetworkKind
  label: string
}

export type GraphRagAuthorHit = {
  id: string
  label: string
  detail: string
  score: number
  path: GraphRagPathNode[]
}

export type GraphRagResult = {
  query: string
  mode: GraphRagMode
  stage: GraphRagStage
  keywords: GraphRagKeywords
  entities: GraphRagEntity[]
  subgraph: { nodeIds: string[]; edgeIds: string[] }
  authors: GraphRagAuthorHit[]
}

export const GRAPH_RAG_STAGES: { id: Exclude<GraphRagStage, 'idle' | 'empty' | 'ready'>; label: string }[] = [
  { id: 'extracting', label: '抽取实体' },
  { id: 'retrieving', label: '检索节点' },
  { id: 'expanding', label: '扩展子图' },
  { id: 'ranking', label: '排序博主' },
]

const LAYER_SCORE: Record<AuthorNetworkKind, number> = {
  question: 1,
  concept: 0.72,
  carrier: 0.42,
  author: 0.55,
}

function emptyResult(query: string, mode: GraphRagMode, stage: GraphRagStage = 'idle'): GraphRagResult {
  return {
    query,
    mode,
    stage,
    keywords: { query, highLevel: [], lowLevel: [] },
    entities: [],
    subgraph: { nodeIds: [], edgeIds: [] },
    authors: [],
  }
}

function tokenize(query: string) {
  return [...new Set(query.split(/[\s,，。！？、:：；;]+/).map((item) => item.trim()).filter((item) => item.length >= 2))]
}

function overlap(text: string, keywords: readonly string[]) {
  const hay = text.toLowerCase()
  let score = 0
  for (const word of keywords) {
    const needle = word.toLowerCase()
    if (!needle) continue
    if (hay === needle) score += 1.4
    else if (hay.includes(needle) || needle.includes(hay)) score += 1
  }
  return score
}

export function extractGraphKeywords(query: string, store: AuthorNetworkStore): GraphRagKeywords {
  const tokens = tokenize(query)
  const highLevel: string[] = []
  const lowLevel: string[] = []
  for (const node of store.nodes) {
    if (overlap(node.label, tokens) <= 0 && overlap(node.detail, tokens) <= 0) continue
    if (node.kind === 'carrier') highLevel.push(node.label)
    if (node.kind === 'concept' || node.kind === 'question') lowLevel.push(node.label)
  }
  if (!highLevel.length && !lowLevel.length) {
    if (query.trim().length < 50) lowLevel.push(query.trim())
  }
  return {
    query,
    highLevel: [...new Set(highLevel)],
    lowLevel: [...new Set(lowLevel.length ? lowLevel : tokens)],
  }
}

export function retrieveGraphEntities(store: AuthorNetworkStore, keywords: GraphRagKeywords, mode: GraphRagMode, topK = 8): GraphRagEntity[] {
  const localWords = keywords.lowLevel
  const globalWords = keywords.highLevel.length ? keywords.highLevel : keywords.lowLevel
  const scored = store.nodes.flatMap((node) => {
    const local = node.kind === 'concept' || node.kind === 'question' || node.kind === 'author'
    const global = node.kind === 'carrier'
    if (mode === 'local' && !local) return []
    if (mode === 'global' && !global) return []
    const words = global ? globalWords : localWords
    const score = overlap(node.label, words) * 1.4 + overlap(node.detail, words) * 0.45
    if (score <= 0) return []
    return [{ id: node.id, kind: node.kind, label: node.label, score: Number((score * LAYER_SCORE[node.kind]).toFixed(3)) }]
  })
  return scored.sort((a, b) => b.score - a.score).slice(0, topK)
}

function walkNeighbors(id: string, edges: readonly AuthorNetworkEdge[]) {
  const next = new Set<string>()
  for (const child of childrenOf(id, edges, 'has-concept')) next.add(child)
  for (const child of childrenOf(id, edges, 'has-question')) next.add(child)
  for (const author of authorsAt(id, edges)) next.add(author)
  for (const parent of parentsOf(id, edges, 'has-concept')) next.add(parent)
  for (const parent of parentsOf(id, edges, 'has-question')) next.add(parent)
  for (const host of hostsOfAuthor(id, edges)) next.add(host)
  return next
}

export function expandAuthorSubgraph(store: AuthorNetworkStore, seeds: readonly GraphRagEntity[], hops = 3) {
  const nodeIds = new Set(seeds.map((item) => item.id))
  let frontier = [...nodeIds]
  for (let hop = 0; hop < hops; hop += 1) {
    const grown: string[] = []
    for (const id of frontier) {
      for (const next of walkNeighbors(id, store.edges)) {
        if (nodeIds.has(next)) continue
        nodeIds.add(next)
        grown.push(next)
      }
    }
    frontier = grown
    if (!frontier.length) break
  }
  const edgeIds = store.edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)).map((edge) => edge.id)
  return { nodeIds: [...nodeIds], edgeIds }
}

function shortestPath(store: AuthorNetworkStore, fromIds: readonly string[], authorId: string) {
  const starts = fromIds.filter((id) => id !== authorId)
  const queue = starts.map((id) => [id])
  const seen = new Set(starts)
  while (queue.length) {
    const path = queue.shift()
    if (!path) break
    const current = path[path.length - 1]
    if (current === authorId) return path
    for (const next of walkNeighbors(current, store.edges)) {
      if (seen.has(next)) continue
      seen.add(next)
      queue.push([...path, next])
    }
  }
  return [authorId]
}

export function rankRelatedAuthors(store: AuthorNetworkStore, seeds: readonly GraphRagEntity[], subgraphNodeIds: readonly string[], topK = 8): GraphRagAuthorHit[] {
  const seedIds = seeds.map((item) => item.id)
  const byId = new Map(store.nodes.map((node) => [node.id, node]))
  const hits = subgraphNodeIds.flatMap((id) => {
    const node = byId.get(id)
    if (!node || node.kind !== 'author') return []
    const pathIds = shortestPath(store, seedIds, node.id)
    const path = pathIds.map((step) => {
      const item = byId.get(step)
      return { id: step, kind: item?.kind ?? 'author', label: item?.label ?? step }
    })
    const attach = path.find((item) => item.kind !== 'author')
    const hops = Math.max(0, path.length - 1)
    const seedBoost = seeds.find((item) => pathIds.includes(item.id))?.score ?? 0.4
    const score = seedBoost * (attach ? LAYER_SCORE[attach.kind] : 0.5) * (1 / (1 + hops * 0.35))
    return [{ id: node.id, label: node.label, detail: node.detail, score: Number(score.toFixed(3)), path }]
  })
  const unique = new Map<string, GraphRagAuthorHit>()
  for (const hit of hits.sort((a, b) => b.score - a.score)) {
    if (!unique.has(hit.id)) unique.set(hit.id, hit)
  }
  return [...unique.values()].slice(0, topK)
}

export function searchRelatedAuthors(query: string, store: AuthorNetworkStore, mode: GraphRagMode = 'local'): GraphRagResult {
  const trimmed = query.trim()
  if (!trimmed) return emptyResult(query, mode, 'idle')
  const keywords = extractGraphKeywords(trimmed, store)
  const entities = retrieveGraphEntities(store, keywords, mode)
  if (!entities.length) return { ...emptyResult(trimmed, mode, 'empty'), keywords }
  const subgraph = expandAuthorSubgraph(store, entities)
  const authors = rankRelatedAuthors(store, entities, subgraph.nodeIds)
  return {
    query: trimmed,
    mode,
    stage: authors.length ? 'ready' : 'empty',
    keywords,
    entities,
    subgraph,
    authors,
  }
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export async function runAuthorGraphRag(
  query: string,
  store: AuthorNetworkStore,
  onStage?: (result: GraphRagResult) => void,
  mode: GraphRagMode = 'local',
): Promise<GraphRagResult> {
  const trimmed = query.trim()
  if (!trimmed) {
    const idle = emptyResult(query, mode, 'idle')
    onStage?.(idle)
    return idle
  }
  const draft = emptyResult(trimmed, mode, 'extracting')
  onStage?.(draft)
  await wait(140)
  const keywords = extractGraphKeywords(trimmed, store)
  onStage?.({ ...draft, stage: 'retrieving', keywords })
  await wait(160)
  const entities = retrieveGraphEntities(store, keywords, mode)
  if (!entities.length) {
    const empty = { ...draft, stage: 'empty' as const, keywords }
    onStage?.(empty)
    return empty
  }
  onStage?.({ ...draft, stage: 'expanding', keywords, entities })
  await wait(180)
  const subgraph = expandAuthorSubgraph(store, entities)
  onStage?.({ ...draft, stage: 'ranking', keywords, entities, subgraph })
  await wait(140)
  const authors = rankRelatedAuthors(store, entities, subgraph.nodeIds)
  const ready: GraphRagResult = {
    query: trimmed,
    mode,
    stage: authors.length ? 'ready' : 'empty',
    keywords,
    entities,
    subgraph,
    authors,
  }
  onStage?.(ready)
  return ready
}
