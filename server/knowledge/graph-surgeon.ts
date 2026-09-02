import { createHash } from 'node:crypto'
import type { CanonicalAnswer } from './canonical-answer.ts'

export type GraphRoot = {
  nodeId: string
  title: string
  role: 'root'
  canonicalContentHash: string
}

export type KnowledgeGraphSnapshot = {
  graphId: string
  routeId: string
  conceptId: string
  canonicalContentHash: string
  revision: number
  root: GraphRoot
}

export type GraphBootstrapResult =
  | { kind: 'completed'; graph: KnowledgeGraphSnapshot; reused: boolean; draftCount: 0 }
  | {
    kind: 'failed'
    code: 'CANONICAL_MISSING' | 'GRAPH_BOOTSTRAP_FAILED' | 'INVALID_SCOPE'
    message: string
  }

export type CanonicalLookup = {
  get(routeId: string, conceptId: string): CanonicalAnswer | undefined
}

function scopeKey(routeId: string, conceptId: string): string {
  return `${routeId.trim()}::${conceptId.trim()}`
}

function graphIdOf(routeId: string, conceptId: string): string {
  const digest = createHash('sha256').update(scopeKey(routeId, conceptId), 'utf8').digest('hex')
  return `kg_${digest.slice(0, 32)}`
}

export function createGraphSurgeon(canonical: CanonicalLookup) {
  const graphs = new Map<string, KnowledgeGraphSnapshot>()
  const inflight = new Map<string, Promise<GraphBootstrapResult>>()

  const get = (routeId: string, conceptId: string): KnowledgeGraphSnapshot | undefined => {
    return graphs.get(scopeKey(routeId, conceptId))
  }

  const bootstrap = (input: {
    routeId: string
    conceptId: string
    title: string
  }): Promise<GraphBootstrapResult> => {
    const routeId = input.routeId.trim()
    const conceptId = input.conceptId.trim()
    const title = input.title.trim()
    if (!routeId || !conceptId || !title) {
      return Promise.resolve({
        kind: 'failed',
        code: 'INVALID_SCOPE',
        message: '创建知识脉络需要明确的路线、概念和标题。',
      })
    }
    const key = scopeKey(routeId, conceptId)
    const existing = graphs.get(key)
    if (existing) {
      return Promise.resolve({ kind: 'completed', graph: existing, reused: true, draftCount: 0 })
    }
    const pending = inflight.get(key)
    if (pending) return pending

    const run = (async (): Promise<GraphBootstrapResult> => {
      const answer = canonical.get(routeId, conceptId)
      if (!answer) {
        return {
          kind: 'failed',
          code: 'CANONICAL_MISSING',
          message: '还没有已 settle 的首次回复，不能创建知识脉络。GraphSurgeon 不会发明根节点，也不会重新生成首次回复。',
        }
      }
      const raced = graphs.get(key)
      if (raced) return { kind: 'completed', graph: raced, reused: true, draftCount: 0 }
      const graph: KnowledgeGraphSnapshot = {
        graphId: graphIdOf(routeId, conceptId),
        routeId,
        conceptId,
        canonicalContentHash: answer.contentHash,
        revision: 1,
        root: {
          nodeId: 'root',
          title,
          role: 'root',
          canonicalContentHash: answer.contentHash,
        },
      }
      graphs.set(key, graph)
      return { kind: 'completed', graph, reused: false, draftCount: 0 }
    })().finally(() => {
      inflight.delete(key)
    })

    inflight.set(key, run)
    return run
  }

  return { get, bootstrap }
}

export type GraphSurgeonStore = ReturnType<typeof createGraphSurgeon>
