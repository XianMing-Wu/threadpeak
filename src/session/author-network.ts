import { useEffect, useState } from 'react'
import { authorSkies } from '../data'
import { blueprintConcepts, exampleBlueprints } from '../workspace/catalog'
import { blueprintOf } from '../workspace/store'
import type { AskAuthorsAnnotation } from './ask-authors'

/** Isolated prototype store. Product `#authors` network must not compose this into user-request success. */

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

export type AuthorNetworkStore = {
  version: 2
  nodes: AuthorNetworkNode[]
  edges: AuthorNetworkEdge[]
}

const NETWORK_KEY = 'threadpeak-author-network-v2'
const NETWORK_EVENT = 'threadpeak-author-network'

export const NETWORK_KIND_META: Record<AuthorNetworkKind, { label: string; color: string; radius: number; mass: number }> = {
  carrier: { label: '载体层', color: '#5dade2', radius: 13, mass: 4 },
  concept: { label: '概念层', color: '#c0392b', radius: 7.5, mass: 2 },
  question: { label: '问题层', color: '#f4d03f', radius: 5, mass: 1 },
  author: { label: '博主', color: '#1f4e79', radius: 6.5, mass: 1.2 },
}

export const NETWORK_KIND_ORDER: AuthorNetworkKind[] = ['carrier', 'concept', 'question', 'author']

const SEED_QUESTIONS: Record<string, string[]> = {
  向量空间: ['基和维数怎么对应到具体计算？', '线性组合为什么能张成整个空间？'],
  线性变换: ['为什么矩阵可以被理解为线性变换？', '变换后哪些方向被压缩了？'],
  '核、像与秩': ['核空间里的向量在变换后去了哪里？'],
  特征值与特征向量: ['特征向量究竟“特征”在哪里？'],
  方差与协方差: ['协方差为什么能描述两个变量一起怎么变？'],
  协方差矩阵: ['协方差矩阵的特征方向在数据里意味着什么？'],
  '主成分分析 PCA': ['为什么最大方差方向能够保留最多信息？', '二维数据上 PCA 到底留下了什么？'],
  主成分分析: ['为什么最大方差方向能够保留最多信息？', '怎样用一个二维例子看出 PCA 保留了什么？'],
  二维数据投影: ['投影之后丢掉的信息要怎么看见？'],
  论点与结论: ['怎样把作者真正要你接受的判断单独拎出来？'],
  隐含前提: ['没写出来的假设怎样被检查出来？'],
  证据质量: ['例子、统计和权威引用该怎么分开看？'],
  反例与例外: ['什么样的具体情形能让原结论失效？'],
  论证结构: ['长回答怎样压成结论-理由-反驳的骨架？'],
  常见谬误: ['偷换概念和以偏概全通常藏在哪一句？'],
  渲染管线: ['从 HTML 到图层合成的真实顺序是什么？'],
  组件模型: ['界面怎样拆成有边界的可复用单元？'],
  状态更新: ['谁拥有数据、谁只负责显示？'],
  数据流: ['请求、缓存和界面一致性怎么接在一起？'],
  性能边界: ['哪些优化真的改变用户感知？'],
  构建与发布: ['分层、打包和线上回滚的最小闭环是什么？'],
  检索练习: ['怎样把检索练习嵌进日常阅读而不是另起炉灶？'],
  反馈循环: ['怎样把零散输入变成可以长期迭代的学习系统？'],
  系统架构: ['复杂信息怎样组织成读者可以行动的结构？'],
  知识可视化: ['怎样让知识结构清晰可视，又不会难维护？'],
}

function emptyStore(): AuthorNetworkStore {
  return { version: 2, nodes: [], edges: [] }
}

function isKind(value: unknown): value is AuthorNetworkKind {
  return value === 'carrier' || value === 'concept' || value === 'question' || value === 'author'
}

function isEdgeKind(value: unknown): value is AuthorNetworkEdgeKind {
  return value === 'has-concept' || value === 'has-question' || value === 'authored-at'
}

function isNode(value: unknown): value is AuthorNetworkNode {
  if (!value || typeof value !== 'object') return false
  const item = value as AuthorNetworkNode
  return typeof item.id === 'string' && typeof item.label === 'string' && isKind(item.kind)
}

function isEdge(value: unknown): value is AuthorNetworkEdge {
  if (!value || typeof value !== 'object') return false
  const item = value as AuthorNetworkEdge
  return typeof item.id === 'string' && typeof item.source === 'string' && typeof item.target === 'string' && isEdgeKind(item.kind)
}

export function slug(value: string, fallback: string) {
  const compact = value.replace(/\s+/g, '').replace(/[^\u4e00-\u9fffA-Za-z0-9-]/g, '')
  return compact || fallback
}

export function nodeId(kind: AuthorNetworkKind, raw: string) {
  const prefix = `${kind}:`
  return raw.startsWith(prefix) ? raw : `${prefix}${raw}`
}

function upsertNode(store: AuthorNetworkStore, node: AuthorNetworkNode) {
  const index = store.nodes.findIndex((item) => item.id === node.id)
  if (index >= 0) store.nodes[index] = { ...store.nodes[index], ...node }
  else store.nodes.push(node)
}

function upsertEdge(store: AuthorNetworkStore, source: string, target: string, kind: AuthorNetworkEdgeKind) {
  const id = `${kind}:${source}->${target}`
  if (!store.edges.some((item) => item.id === id)) store.edges.push({ id, source, target, kind })
}

export function childrenOf(id: string, edges: readonly AuthorNetworkEdge[], kind?: AuthorNetworkEdgeKind) {
  return edges.filter((edge) => edge.source === id && (!kind || edge.kind === kind)).map((edge) => edge.target)
}

export function parentsOf(id: string, edges: readonly AuthorNetworkEdge[], kind?: AuthorNetworkEdgeKind) {
  return edges.filter((edge) => edge.target === id && (!kind || edge.kind === kind)).map((edge) => edge.source)
}

export function authorsAt(hostId: string, edges: readonly AuthorNetworkEdge[]) {
  return edges.filter((edge) => edge.kind === 'authored-at' && edge.target === hostId).map((edge) => edge.source)
}

export function hostsOfAuthor(authorId: string, edges: readonly AuthorNetworkEdge[]) {
  return edges.filter((edge) => edge.kind === 'authored-at' && edge.source === authorId).map((edge) => edge.target)
}

export function neighborIds(id: string, edges: readonly AuthorNetworkEdge[]) {
  const next = new Set<string>([id])
  for (const edge of edges) {
    if (edge.source === id) next.add(edge.target)
    if (edge.target === id) next.add(edge.source)
  }
  return next
}

export function pathLabels(path: readonly string[], nodes: readonly AuthorNetworkNode[]) {
  return path.map((id) => nodes.find((node) => node.id === id)?.label ?? id)
}

function questionsFor(title: string) {
  return SEED_QUESTIONS[title] ?? [`如何理解「${title}」？`, `学习「${title}」时最容易卡在哪里？`]
}

function attachAuthor(
  store: AuthorNetworkStore,
  author: { id: string; name: string; detail: string },
  hostId: string,
) {
  const id = nodeId('author', author.id)
  upsertNode(store, { id, kind: 'author', label: author.name, detail: author.detail })
  upsertEdge(store, id, hostId, 'authored-at')
}

export function authorNetworkEventName() {
  return NETWORK_EVENT
}

export function seedAuthorNetwork(): AuthorNetworkStore {
  const store = emptyStore()

  for (const blueprint of exampleBlueprints) {
    for (const carrier of blueprint.carriers) {
      const carrierKey = nodeId('carrier', slug(carrier.title, carrier.id))
      upsertNode(store, { id: carrierKey, kind: 'carrier', label: carrier.title, detail: carrier.summary })
      for (const [id, title, summary] of carrier.concepts) {
        const conceptKey = nodeId('concept', slug(title, id))
        upsertNode(store, { id: conceptKey, kind: 'concept', label: title, detail: summary })
        upsertEdge(store, carrierKey, conceptKey, 'has-concept')
      }
    }
  }

  for (const sky of authorSkies) {
    for (const carrier of sky.carriers) {
      const carrierKey = nodeId('carrier', slug(carrier.title, carrier.id))
      upsertNode(store, { id: carrierKey, kind: 'carrier', label: carrier.title, detail: sky.subtitle })
    }
    for (const concept of sky.concepts) {
      const conceptKey = nodeId('concept', slug(concept.title, concept.id))
      upsertNode(store, { id: conceptKey, kind: 'concept', label: concept.title, detail: sky.title })
      const nearest = sky.carriers.reduce((best, carrier) => {
        const distance = Math.abs(carrier.x - concept.label.x)
        return !best || distance < best.distance ? { id: carrier.id, title: carrier.title, distance } : best
      }, null as { id: string; title: string; distance: number } | null)
      if (nearest) upsertEdge(store, nodeId('carrier', slug(nearest.title, nearest.id)), conceptKey, 'has-concept')

      const conceptAuthors = concept.authors.flatMap((authorId) => {
        const author = sky.authors.find((item) => item.id === authorId)
        if (!author || author.carrierId === 'self') return []
        return [{ id: author.id, name: author.name, detail: `${author.role} · ${author.work}` }]
      })
      for (const author of conceptAuthors) attachAuthor(store, author, conceptKey)

      questionsFor(concept.title).forEach((question, index) => {
        const questionKey = nodeId('question', `${slug(concept.title, concept.id)}-${index}`)
        upsertNode(store, { id: questionKey, kind: 'question', label: question, detail: `挂在「${concept.title}」下的问题` })
        upsertEdge(store, conceptKey, questionKey, 'has-question')
        const picked = conceptAuthors.slice(index, index + 3)
        for (const author of picked.length ? picked : conceptAuthors.slice(0, 2)) attachAuthor(store, author, questionKey)
      })
    }
    for (const author of sky.authors) {
      if (author.carrierId === 'self') continue
      const carrier = sky.carriers.find((item) => item.id === author.carrierId)
      if (!carrier) continue
      attachAuthor(store, { id: author.id, name: author.name, detail: `${author.role} · ${author.work}` }, nodeId('carrier', slug(carrier.title, carrier.id)))
    }
  }

  for (const context of [
    { concept: '主成分分析 PCA', question: '为什么最大方差方向能够保留最多信息？' },
    { concept: '反馈循环', question: '怎样把零散输入变成可以长期迭代的学习系统？' },
  ]) {
    const conceptKey = nodeId('concept', slug(context.concept, context.concept))
    if (!store.nodes.some((node) => node.id === conceptKey)) continue
    const questionKey = nodeId('question', slug(context.question, 'seed-q'))
    upsertNode(store, { id: questionKey, kind: 'question', label: context.question, detail: '从咨询问题沉淀到图谱' })
    upsertEdge(store, conceptKey, questionKey, 'has-question')
  }

  return store
}

export function readAuthorNetwork(): AuthorNetworkStore {
  try {
    const raw = sessionStorage.getItem(NETWORK_KEY)
    if (!raw) return seedAuthorNetwork()
    const parsed = JSON.parse(raw) as Partial<AuthorNetworkStore>
    const nodes = Array.isArray(parsed.nodes) ? parsed.nodes.filter(isNode) : []
    const edges = Array.isArray(parsed.edges) ? parsed.edges.filter(isEdge) : []
    if (parsed.version !== 2 || nodes.length === 0) return seedAuthorNetwork()
    return { version: 2, nodes, edges }
  } catch {
    return seedAuthorNetwork()
  }
}

export function writeAuthorNetwork(store: AuthorNetworkStore) {
  sessionStorage.setItem(NETWORK_KEY, JSON.stringify({ ...store, version: 2 }))
  window.dispatchEvent(new Event(NETWORK_EVENT))
}

function resolveAskContext(scopeId: string) {
  const [left, right] = scopeId.split('::')
  const blueprint = left ? blueprintOf(left) : undefined
  const fromRoute = blueprint ? blueprintConcepts(blueprint).find((item) => item.id === right) : undefined
  if (fromRoute) {
    return {
      conceptId: slug(fromRoute.title, fromRoute.id),
      conceptTitle: fromRoute.title,
      conceptDetail: fromRoute.summary,
      carrierId: slug(fromRoute.carrierTitle, fromRoute.carrierId),
      carrierTitle: fromRoute.carrierTitle,
    }
  }
  for (const item of exampleBlueprints) {
    const hit = blueprintConcepts(item).find((concept) => concept.id === right || concept.id === left)
    if (hit) {
      return {
        conceptId: slug(hit.title, hit.id),
        conceptTitle: hit.title,
        conceptDetail: hit.summary,
        carrierId: slug(hit.carrierTitle, hit.carrierId),
        carrierTitle: hit.carrierTitle,
      }
    }
  }
  return {
    conceptId: slug(right || '当前概念', 'current-concept'),
    conceptTitle: right && right !== 'canvas' ? right : '当前概念',
    conceptDetail: '学习对话中正在停留的概念',
    carrierId: 'current-carrier',
    carrierTitle: '载体层',
  }
}

function relatedAuthors(conceptTitle: string, replyName?: string) {
  const names = new Map<string, { id: string; name: string; detail: string }>()
  if (replyName) {
    const known = authorSkies.flatMap((sky) => sky.authors).find((item) => item.name === replyName)
    names.set(known?.id ?? slug(replyName, 'author'), {
      id: known?.id ?? slug(replyName, 'author'),
      name: replyName,
      detail: known ? `${known.role} · ${known.work}` : '问博主关联作者',
    })
  }
  for (const sky of authorSkies) {
    const concept = sky.concepts.find((item) => item.title === conceptTitle || conceptTitle.includes(item.title) || item.title.includes(conceptTitle))
    if (!concept) continue
    for (const authorId of concept.authors) {
      const author = sky.authors.find((item) => item.id === authorId)
      if (!author || author.carrierId === 'self') continue
      names.set(author.id, { id: author.id, name: author.name, detail: `${author.role} · ${author.work}` })
    }
  }
  return [...names.values()]
}

function applyAskAuthors(store: AuthorNetworkStore, annotation: AskAuthorsAnnotation) {
  const context = resolveAskContext(annotation.scopeId || '')
  const questionKey = nodeId('question', annotation.id)
  const conceptKey = nodeId('concept', context.conceptId)
  const carrierKey = nodeId('carrier', context.carrierId)
  upsertNode(store, { id: carrierKey, kind: 'carrier', label: context.carrierTitle, detail: '问博主时所在的载体层' })
  upsertNode(store, { id: conceptKey, kind: 'concept', label: context.conceptTitle, detail: context.conceptDetail })
  upsertNode(store, {
    id: questionKey,
    kind: 'question',
    label: annotation.question,
    detail: annotation.quote ? `原文：${annotation.quote}` : '学习对话中的问博主问题',
  })
  upsertEdge(store, carrierKey, conceptKey, 'has-concept')
  upsertEdge(store, conceptKey, questionKey, 'has-question')
  for (const author of relatedAuthors(context.conceptTitle, annotation.reply?.name)) {
    attachAuthor(store, author, questionKey)
    attachAuthor(store, author, conceptKey)
  }
}

export function recordAskAuthorsOnNetwork(annotation: AskAuthorsAnnotation) {
  const store = readAuthorNetwork()
  applyAskAuthors(store, annotation)
  writeAuthorNetwork(store)
  return store
}

export function hydrateNetworkFromAnnotations(items: readonly AskAuthorsAnnotation[]) {
  if (!items.length) return
  const store = readAuthorNetwork()
  items.forEach((item) => applyAskAuthors(store, item))
  writeAuthorNetwork(store)
}

export function useAuthorNetwork() {
  const [store, setStore] = useState<AuthorNetworkStore>(readAuthorNetwork)
  useEffect(() => {
    const sync = () => setStore(readAuthorNetwork())
    window.addEventListener(NETWORK_EVENT, sync)
    return () => window.removeEventListener(NETWORK_EVENT, sync)
  }, [])
  return store
}
