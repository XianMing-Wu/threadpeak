import type { CanvasEdge, CanvasNode } from './content'
import {
  defaultNodeTitle,
  inferGrowKind,
  type GrowKind,
  growKindLabel,
} from './generate.ts'

/** Character budgets approximating the model window. */
export const GRAPH_CONTEXT_FULL_LIMIT = 220_000
export const GRAPH_CONTEXT_COMPRESSED_CONTENT = 10_000
export const GRAPH_CONTEXT_NODE_LIMIT = 200_000
export const ANSWER_OUTPUT_LIMIT = 200_000

export type GrowDecision = {
  kind: GrowKind
  title: string
  reason: string
  mergeNodeId: string | null
  source: 'command' | 'model' | 'heuristic'
}

export type GrowCandidate = {
  id: string
  kind: GrowKind
  title: string
  questions: string[]
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function defaultReason(kind: GrowKind, hostTitle: string, quote: string) {
  const cited = quote.trim() ? `引用了「${quote.trim().slice(0, 24)}」，` : ''
  if (kind === 'pred') return `${cited}在「${hostTitle}」之前补一层前提。`
  if (kind === 'par') return `${cited}并列问法，不打断「${hostTitle}」主干。`
  return `${cited}从「${hostTitle}」继续追问。`
}

export function heuristicGrowDecision(
  question: string,
  quote = '',
  hostTitle = '',
): GrowDecision {
  const kind = inferGrowKind(question, quote)
  return {
    kind,
    title: defaultNodeTitle(question || quote, growKindLabel(kind) || '追问'),
    reason: defaultReason(kind, hostTitle, quote),
    mergeNodeId: null,
    source: 'heuristic',
  }
}

export function parseGrowDecision(
  value: unknown,
  allowedMergeIds: ReadonlySet<string>,
  fallback: { question: string; quote?: string; hostTitle?: string; palId?: string },
): GrowDecision {
  const heuristic = heuristicGrowDecision(fallback.question, fallback.quote ?? '', fallback.hostTitle ?? '')
  const record = asRecord(value)
  if (!record) return heuristic
  const rawKind = asText(record.kind)
  const kind: GrowKind = rawKind === 'pred' || rawKind === 'succ' || rawKind === 'par' ? rawKind : heuristic.kind
  const title = asText(record.title) || heuristic.title
  const reason = asText(record.reason) || defaultReason(kind, fallback.hostTitle ?? '', fallback.quote ?? '')
  const rawMerge = asText(record.mergeNodeId)
  const picked = rawMerge && allowedMergeIds.has(rawMerge) ? rawMerge : null
  const palId = fallback.palId && allowedMergeIds.has(fallback.palId) ? fallback.palId : null
  return {
    kind,
    title: title.length > 24 ? `${title.slice(0, 23)}…` : title,
    reason: reason.slice(0, 200),
    mergeNodeId: kind === 'par' ? palId ?? picked : picked,
    source: 'model',
  }
}

function serializeNode(node: CanvasNode): string {
  const kind = growKindLabel(node.grow) || (node.id === 'root' ? '根' : node.role)
  const body = node.turns
    .map((turn) => `问：${turn.question}\n答：${turn.paragraphs.join('\n')}`)
    .join('\n\n')
  return `【${node.id}】${node.title}（${kind}）\n${body}`
}

function serializeStructure(nodes: readonly CanvasNode[], edges: readonly CanvasEdge[]): string {
  const list = nodes.map((node) => (
    `${node.id}\t${node.title}\t${growKindLabel(node.grow) || (node.id === 'root' ? '根' : node.role)}`
  )).join('\n')
  const links = edges.map((edge) => (
    `${edge.from} -[ ${growKindLabel(edge.grow) || edge.kind} ]-> ${edge.to}`
  )).join('\n')
  return `节点\n${list}\n连接\n${links}`
}

export function packGraphContext(
  nodes: readonly CanvasNode[],
  edges: readonly CanvasEdge[],
  hostId: string,
  quote = '',
): { text: string; mode: 'full' | 'compressed' } {
  const host = nodes.find((node) => node.id === hostId) ?? nodes.find((node) => node.id === 'root')
  const targeting = host
    ? `当前问题针对节点卡片 ${host.id}「${host.title}」。${quote.trim() ? `引用：${quote.trim()}` : ''}`
    : '当前问题针对知识脉络根节点。'
  const structure = serializeStructure(nodes, edges)
  const cards = nodes.map(serializeNode).join('\n\n')
  const full = `${targeting}\n\n连接结构：\n${structure}\n\n节点内容：\n${cards}`
  if (full.length <= GRAPH_CONTEXT_FULL_LIMIT) return { text: full, mode: 'full' }
  const others = nodes.filter((node) => node.id !== host?.id)
  let compressed = ''
  for (const node of others) {
    const summary = `【${node.id}】${node.title}：${node.turns[0]?.question ?? ''}`.slice(0, 120)
    if (compressed.length + summary.length + 1 > GRAPH_CONTEXT_COMPRESSED_CONTENT) break
    compressed += `${compressed ? '\n' : ''}${summary}`
  }
  const hostFull = host ? serializeNode(host).slice(0, GRAPH_CONTEXT_NODE_LIMIT) : ''
  return {
    text: `${targeting}\n\n完整连接结构：\n${structure}\n\n其他节点压缩：\n${compressed || '无'}\n\n针对节点全文：\n${hostFull}`,
    mode: 'compressed',
  }
}

export function growCandidateList(
  nodes: readonly CanvasNode[],
  edges: readonly CanvasEdge[],
  hostId: string,
): GrowCandidate[] {
  const pal = nodes.find((node) => node.role === 'parallel' && node.hostId === hostId)
  const predIds = new Set(edges.filter((edge) => edge.grow === 'pred' && edge.to === hostId).map((edge) => edge.from))
  const succIds = new Set(edges.filter((edge) => edge.grow === 'succ' && edge.from === hostId).map((edge) => edge.to))
  const out: GrowCandidate[] = []
  const push = (node: CanvasNode | undefined, kind: GrowKind) => {
    if (!node) return
    out.push({
      id: node.id,
      kind,
      title: node.title,
      questions: node.turns.map((turn) => turn.question),
    })
  }
  push(pal, 'par')
  for (const node of nodes) {
    if (predIds.has(node.id)) push(node, 'pred')
    if (succIds.has(node.id)) push(node, 'succ')
  }
  return out
}

export function allowedMergeIds(candidates: readonly GrowCandidate[]): Set<string> {
  return new Set(candidates.map((item) => item.id))
}
