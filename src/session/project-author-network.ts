import type { PathLayerDocument } from './layer-title.ts'
import type { AuthorNetworkMember } from './request-author-network.ts'
import { resolveNetworkCarrierTitle, resolveNetworkLayerTitle } from './resolve-layer-title.ts'

export type AuthorNetworkKind = 'carrier' | 'concept' | 'question' | 'author'
export type AuthorNetworkEdgeKind = 'has-concept' | 'has-question' | 'authored-at'

export type AuthorNetworkNode = {
  id: string
  kind: AuthorNetworkKind
  label: string
  detail: string
}

export type AuthorNetworkEdge = {
  id: string
  source: string
  target: string
  kind: AuthorNetworkEdgeKind
}

export type AuthorNetworkGraphModel = {
  nodes: AuthorNetworkNode[]
  edges: AuthorNetworkEdge[]
}

export const NETWORK_KIND_META: Record<AuthorNetworkKind, { label: string; color: string; radius: number; mass: number }> = {
  carrier: { label: '载体层', color: '#5dade2', radius: 13, mass: 4 },
  concept: { label: '概念层', color: '#c0392b', radius: 7.5, mass: 2 },
  question: { label: '问题层', color: '#f4d03f', radius: 5, mass: 1 },
  author: { label: '博主', color: '#1f4e79', radius: 6.5, mass: 1.2 },
}

export const NETWORK_KIND_ORDER: AuthorNetworkKind[] = ['carrier', 'concept', 'question', 'author']

function slug(value: string, fallback: string) {
  const compact = value.replace(/\s+/g, '').replace(/[^\u4e00-\u9fffA-Za-z0-9-]/g, '')
  return compact || fallback
}

export function nodeId(kind: AuthorNetworkKind, raw: string) {
  const prefix = `${kind}:`
  return raw.startsWith(prefix) ? raw : `${prefix}${raw}`
}

function upsertNode(store: AuthorNetworkGraphModel, node: AuthorNetworkNode) {
  const index = store.nodes.findIndex((item) => item.id === node.id)
  if (index >= 0) store.nodes[index] = { ...store.nodes[index], ...node }
  else store.nodes.push(node)
}

function upsertEdge(store: AuthorNetworkGraphModel, source: string, target: string, kind: AuthorNetworkEdgeKind) {
  const id = `${kind}:${source}->${target}`
  if (!store.edges.some((item) => item.id === id)) store.edges.push({ id, source, target, kind })
}

export function childrenOf(id: string, edges: readonly AuthorNetworkEdge[], kind?: AuthorNetworkEdgeKind) {
  return edges.filter((edge) => edge.source === id && (!kind || edge.kind === kind)).map((edge) => edge.target)
}

export function neighborIds(id: string, edges: readonly AuthorNetworkEdge[]) {
  const next = new Set<string>([id])
  for (const edge of edges) {
    if (edge.source === id) next.add(edge.target)
    if (edge.target === id) next.add(edge.source)
  }
  return next
}

/** Project enrolled authors only. High-weight keeps carrier→concept→question; low-weight keeps question→author. */
export function projectAuthorNetworkGraph(
  members: readonly AuthorNetworkMember[],
  routes?: readonly { document?: PathLayerDocument }[],
): AuthorNetworkGraphModel {
  const store: AuthorNetworkGraphModel = { nodes: [], edges: [] }
  for (const member of members) {
    const authorKey = nodeId('author', slug(member.authorId, member.name))
    upsertNode(store, {
      id: authorKey,
      kind: 'author',
      label: member.name,
      detail: member.weight === 'high' ? '高权 · 问博主写入' : '低权 · 搜索补位',
    })
    const question = member.question.trim()
    const conceptTitle = resolveNetworkLayerTitle(member.conceptTitle, routes)
      || resolveNetworkLayerTitle(member.conceptId, routes)
    const carrierTitle = resolveNetworkCarrierTitle({
      carrierTitle: member.carrierTitle,
      carrierId: member.carrierId,
      conceptId: member.conceptId,
      conceptTitle: member.conceptTitle,
    }, routes)
    let hostId = ''
    if (carrierTitle && member.weight === 'high') {
      const carrierKey = nodeId('carrier', slug(carrierTitle, 'carrier'))
      upsertNode(store, { id: carrierKey, kind: 'carrier', label: carrierTitle, detail: '问博主时所在的载体层' })
      hostId = carrierKey
    }
    if (conceptTitle && member.weight === 'high') {
      const conceptKey = nodeId('concept', slug(conceptTitle, 'concept'))
      upsertNode(store, { id: conceptKey, kind: 'concept', label: conceptTitle, detail: '问博主时所在的概念层' })
      if (hostId) upsertEdge(store, hostId, conceptKey, 'has-concept')
      hostId = conceptKey
    }
    if (question) {
      const questionKey = nodeId('question', slug(question, `${authorKey}-q`))
      upsertNode(store, {
        id: questionKey,
        kind: 'question',
        label: question,
        detail: member.weight === 'high' ? '问博主整理后的问题' : '搜索博主时的问题',
      })
      if (hostId) upsertEdge(store, hostId, questionKey, 'has-question')
      hostId = questionKey
    }
    if (hostId) upsertEdge(store, authorKey, hostId, 'authored-at')
  }
  return store
}
