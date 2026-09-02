import type { CanvasEdge, CanvasNode, NodeTurn } from './content'

/**
 * Node growth, adapted from thread-chatbot `store.fork` + `handleFork`:
 * new id, attach to a source, notify/select. That project only forks a child
 * (后置). We also splice a predecessor (前置) and hang a dashed parallel (并列).
 */
export type GrowKind = 'pred' | 'succ' | 'par'

export const TURN_HOST_PREFIX = 'turn:'

export function growKindLabel(kind?: GrowKind) {
  return kind === 'pred' ? '前置' : kind === 'par' ? '并列' : kind === 'succ' ? '后置' : ''
}

export function parseTurnHost(id?: string): number | null {
  if (!id?.startsWith(TURN_HOST_PREFIX)) return null
  const index = Number(id.slice(TURN_HOST_PREFIX.length))
  return Number.isInteger(index) ? index : null
}

function compactHay(text: string) {
  return text.replace(/\s+/g, '')
}

function nodeSearchParts(node: CanvasNode): string[] {
  return [
    node.title,
    ...node.turns.flatMap((turn) => [turn.title ?? '', turn.question, ...turn.paragraphs]),
  ]
}

/** True when the snippet only appears inside the coach echo 「你刚刚问的是…」. */
function quoteOnlyInEcho(text: string, needle: string) {
  const echoed = /你刚刚问的是[「『]([\s\S]*?)[」』]/.exec(text)
  if (!echoed) return false
  const inside = compactHay(echoed[1]).includes(needle)
  const before = compactHay(text.slice(0, echoed.index)).includes(needle)
  const after = compactHay(text.slice(echoed.index + echoed[0].length)).includes(needle)
  return inside && !before && !after
}

/**
 * The quoted bubble owns the next grow. Prefer the card whose own wording
 * contains the snippet; ignore the same words when they only reappear as an echo.
 */
export function findHostByQuote(nodes: readonly CanvasNode[], quote: string): string | null {
  const needle = compactHay(plainQuoteText(quote))
  if (needle.length < 2) return null
  let best: { id: string; score: number } | null = null
  for (const node of nodes) {
    let score = 0
    for (const part of nodeSearchParts(node)) {
      const hay = compactHay(part)
      if (!hay.includes(needle)) continue
      const specificity = needle.length / Math.max(hay.length, needle.length)
      score = Math.max(score, (quoteOnlyInEcho(part, needle) ? 0.15 : 1) + specificity)
    }
    if (score > 0 && (!best || score > best.score)) best = { id: node.id, score }
  }
  return best?.id ?? null
}

export function replyCardTitle(reply: string, fallback: string) {
  const stripped = reply
    .replace(/^针对「[^」]+」，你刚刚问的是「[\s\S]*?」。/, '')
    .replace(/^(authors|visual|coach)$/,'')
    .trim()
  return defaultNodeTitle(stripped || reply, fallback)
}

export function parseGrowCommand(text: string): { kind: GrowKind; question: string } | null {
  const match = /^([123])(?:\s+([\s\S]*))?$/.exec(text.trim())
  if (!match) return null
  return {
    kind: match[1] === '1' ? 'pred' : match[1] === '2' ? 'succ' : 'par',
    question: match[2]?.trim() ?? '',
  }
}

export function readGrowCommand(text: string): { kind: GrowKind; question: string } | null {
  const trimmed = text.trim()
  const direct = parseGrowCommand(trimmed)
  if (direct) return direct
  const lines = trimmed.split(/\n/)
  if (lines.length < 2) return null
  const last = parseGrowCommand(lines[lines.length - 1] ?? '')
  if (!last) return null
  return { kind: last.kind, question: last.question || lines.slice(0, -1).join('\n').trim() }
}

export function inferGrowKind(question: string, quote = ''): GrowKind {
  const explicit = parseGrowCommand(question) ?? readGrowCommand(question)
  if (explicit) return explicit.kind
  const text = question.trim()
  if (/前提|先理解|之前需要|为什么先/.test(text)) return 'pred'
  if (/举个例子|给我举个例|举例|给个例子|一个例子|比如|实例|另一种问法|换个说法|并列/.test(text)) return 'par'
  if (quote.trim()) return 'par'
  return 'succ'
}

/** Walk off a dashed card onto its flow host. Parallels never parent anything. */
export function flowHostId(nodes: readonly CanvasNode[], id: string): string {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  let current = byId.get(id)
  const seen = new Set<string>()
  while (current?.role === 'parallel' && current.hostId && !seen.has(current.id)) {
    seen.add(current.id)
    current = byId.get(current.hostId)
  }
  return current?.role === 'parallel' ? (current.hostId || id) : (current?.id ?? id)
}

/** Selection or quote attaches to that bubble's card, not the walking cursor. */
export function resolveQuotedHost(
  nodes: readonly CanvasNode[],
  fallbackId: string,
  quote?: string,
  quoteFromId?: string,
  turnHostId?: string,
): string {
  if (quoteFromId && nodes.some((node) => node.id === quoteFromId)) {
    return flowHostId(nodes, quoteFromId)
  }
  if (turnHostId && nodes.some((node) => node.id === turnHostId)) {
    return flowHostId(nodes, turnHostId)
  }
  if (quote) {
    const found = findHostByQuote(nodes, quote)
    if (found) return flowHostId(nodes, found)
  }
  return flowHostId(nodes, fallbackId)
}

/** Selection or quote on a dashed card always grows from the host above it. */
export function resolveGrowHost(
  nodes: readonly CanvasNode[],
  selectedId: string,
  quote?: string,
  quoteFromId?: string,
): string {
  return resolveQuotedHost(nodes, selectedId, quote, quoteFromId)
}

export function defaultNodeTitle(text: string, fallback: string): string {
  const compact = plainQuoteText(text).replace(/\s+/g, '')
  if (!compact) return fallback
  return compact.length > 13 ? `${compact.slice(0, 13)}…` : compact
}

/** Same-conversation cursor: 后置走到新节点，前置/并列仍停在原来的主干节点。 */
export function conversationHostAfterGrow(kind: GrowKind, hostId: string, createdId: string) {
  return kind === 'succ' ? createdId : hostId
}

export function plainQuoteText(text: string) {
  let next = text.replace(/\s+/g, ' ').trim()
  const echoed = /你刚刚问的是[「『]([\s\S]*?)[」』](?:\s*[123])?[」。]/.exec(next)
  if (echoed) next = echoed[1].replace(/\s+/g, ' ').trim()
  for (let i = 0; i < 4; i++) {
    const wrapped = /^(?:引用)?[「『]([\s\S]+)[」』]$/.exec(next)
    if (wrapped) {
      next = wrapped[1].replace(/\s+/g, ' ').trim()
      continue
    }
    const prefix = /^(?:引用)[「『]/.exec(next)
    if (prefix) {
      next = next.slice(prefix[0].length).replace(/[」』]+$/g, '').trim()
      continue
    }
    break
  }
  return next.replace(/^[「『]+/, '').replace(/[」』]+$/, '').trim()
}

function nextId(prefix: string, used: ReadonlySet<string>): string {
  let n = 1
  while (used.has(`${prefix}${n}`)) n += 1
  return `${prefix}${n}`
}

export function similarQuestion(left: string, right: string): boolean {
  const a = compactHay(plainQuoteText(left))
  const b = compactHay(plainQuoteText(right))
  if (a.length < 4 || b.length < 4) return false
  if (a === b || a.includes(b) || b.includes(a)) return true
  const grams = (text: string) => {
    const set = new Set<string>()
    for (let index = 0; index < text.length - 1; index += 1) set.add(text.slice(index, index + 2))
    return set
  }
  const leftGrams = grams(a)
  const rightGrams = grams(b)
  if (leftGrams.size === 0 || rightGrams.size === 0) return false
  let overlap = 0
  for (const gram of leftGrams) if (rightGrams.has(gram)) overlap += 1
  return overlap / Math.max(leftGrams.size, rightGrams.size) >= 0.55
}

function childNodesOf(
  nodes: readonly CanvasNode[],
  edges: readonly CanvasEdge[],
  hostId: string,
  kind: GrowKind,
): CanvasNode[] {
  if (kind === 'par') return nodes.filter((node) => node.role === 'parallel' && node.hostId === hostId)
  if (kind === 'pred') {
    const ids = new Set(edges.filter((edge) => edge.grow === 'pred' && edge.to === hostId).map((edge) => edge.from))
    return nodes.filter((node) => ids.has(node.id))
  }
  const ids = new Set(edges.filter((edge) => edge.grow === 'succ' && edge.from === hostId).map((edge) => edge.to))
  return nodes.filter((node) => ids.has(node.id))
}

export function findMergeTarget(
  nodes: readonly CanvasNode[],
  edges: readonly CanvasEdge[],
  hostId: string,
  kind: GrowKind,
  question: string,
  quote = '',
  preferredId?: string | null,
): CanvasNode | undefined {
  const resolvedHostId = flowHostId(nodes, hostId)
  const children = childNodesOf(nodes, edges, resolvedHostId, kind)
  if (preferredId) {
    const preferred = children.find((node) => node.id === preferredId)
    if (preferred) return preferred
  }
  if (kind === 'par') return children[0]
  const needle = question || quote
  return children.find((node) => (
    similarQuestion(node.title, needle)
    || node.turns.some((turn) => similarQuestion(turn.question, needle) || similarQuestion(turn.title ?? '', needle))
  ))
}

function mockTurn(
  kind: GrowKind,
  host: CanvasNode,
  question: string,
  quote: string,
  extra?: { title?: string },
): NodeTurn {
  const asked = question || quote || (
    kind === 'pred'
      ? `进入「${host.title}」之前，还缺哪一层？`
      : kind === 'succ'
        ? `从「${host.title}」继续追问什么？`
        : `还有哪种问法可以和「${host.title}」并列？`
  )
  const body = kind === 'pred'
    ? `这是接到「${host.title}」之前的一步。先把前提说清楚，再进入当前节点。`
    : kind === 'succ'
      ? `从「${host.title}」往下走一步。这个问题接在当前主干之后，不改原来的后置。`
      : `这是「${host.title}」的并列问法。写进该节点唯一的虚线卡，不另开一张并列节点。`
  return {
    ...(extra?.title ? { title: extra.title } : {}),
    question: asked,
    replyKind: 'full',
    paragraphs: quote ? [body, `引用落在上方主干「${host.title}」上：${quote}`] : [body],
  }
}

export function parseQuotedUserTurn(text: string): { quote: string; question: string } {
  const raw = text.trim()
  const start = /^(引用)([「『])/.exec(raw)
  if (!start) return { quote: '', question: raw }
  const open = start[2]
  const close = open === '「' ? '」' : '』'
  let depth = 0
  for (let index = start[0].length; index < raw.length; index += 1) {
    const token = raw[index]
    if (token === open) {
      depth += 1
      continue
    }
    if (token !== close) continue
    if (depth > 0) {
      depth -= 1
      continue
    }
    return {
      quote: plainQuoteText(raw.slice(start[0].length, index)),
      question: raw.slice(index + 1).trim(),
    }
  }
  return { quote: plainQuoteText(raw.slice(start[0].length)), question: '' }
}

export function ensureParallelEdges(
  nodes: readonly CanvasNode[],
  edges: readonly CanvasEdge[],
): CanvasEdge[] {
  const next = edges.slice()
  const seen = new Set(
    next.filter((edge) => edge.kind === 'parallel').map((edge) => `${edge.from}\0${edge.to}`),
  )
  for (const node of nodes) {
    if (node.role !== 'parallel' || !node.hostId) continue
    const key = `${node.hostId}\0${node.id}`
    if (seen.has(key)) continue
    seen.add(key)
    next.push({
      id: `eg-par-${node.id}`,
      from: node.hostId,
      to: node.id,
      kind: 'parallel',
      grow: 'par',
      reason: '并列问法，不打断主干。',
    })
  }
  return next
}

export function conversationGraphView(
  nodes: readonly CanvasNode[],
  edges: readonly CanvasEdge[],
  conversationId?: string,
) {
  if (!conversationId) {
    return { nodes: nodes.slice(), edges: ensureParallelEdges(nodes, edges) }
  }
  const keep = new Set(
    nodes.filter((node) => node.id === 'root' || node.conversationId === conversationId).map((node) => node.id),
  )
  const viewNodes = nodes.filter((node) => keep.has(node.id))
  return {
    nodes: viewNodes,
    edges: ensureParallelEdges(viewNodes, edges.filter((edge) => keep.has(edge.from) && keep.has(edge.to))),
  }
}

export function growGraph(
  nodes: readonly CanvasNode[],
  edges: readonly CanvasEdge[],
  hostId: string,
  kind: GrowKind,
  question: string,
  quote = '',
  turn?: NodeTurn,
  conversationId?: string,
  mergeNodeId?: string | null,
  reason?: string,
): { nodes: CanvasNode[]; edges: CanvasEdge[]; created: CanvasNode } | null {
  const resolvedHostId = flowHostId(nodes, hostId)
  const host = nodes.find((node) => node.id === resolvedHostId)
  if (!host || host.role === 'parallel') return null

  const mergeInto = findMergeTarget(nodes, edges, host.id, kind, question, quote, mergeNodeId)
  if (mergeInto) {
    const title = turn?.title || defaultNodeTitle(question || quote, `问法 ${mergeInto.turns.length + 1}`)
    const created = {
      ...mergeInto,
      grow: kind,
      conversationId: mergeInto.conversationId || conversationId,
      turns: [...mergeInto.turns, turn ?? mockTurn(kind, host, question, quote, { title })],
    }
    return {
      nodes: nodes.map((node) => node.id === mergeInto.id ? created : node),
      edges: edges.slice(),
      created,
    }
  }

  const created: CanvasNode = {
    id: nextId('g', new Set(nodes.map((node) => node.id))),
    accent: kind === 'par' ? '#6b7280' : host.accent,
    title: turn?.title || defaultNodeTitle(
      question || quote || turn?.paragraphs.join('') || '',
      kind === 'pred' ? `前置 · ${host.title}` : kind === 'succ' ? `后置 · ${host.title}` : `并列 · ${host.title}`,
    ),
    role: kind === 'par' ? 'parallel' : 'flow',
    hostId: kind === 'par' ? host.id : undefined,
    grow: kind,
    conversationId,
    turns: [turn ?? mockTurn(kind, host, question, quote)],
  }

  const edgeId = nextId('eg', new Set(edges.map((edge) => edge.id)))
  const quoted = quote.replace(/\s+/g, ' ').trim()
  const quoteHint = quoted ? `引用了「${quoted.length > 24 ? `${quoted.slice(0, 24)}…` : quoted}」，` : ''
  const edgeReason = reason?.trim() || (
    kind === 'pred'
      ? `${quoteHint}在「${host.title}」之前补一层前提。`
      : kind === 'succ'
        ? `${quoteHint}从「${host.title}」继续追问，不沿用上一句的展开方式。`
        : `${quoteHint}并列问法，不打断「${host.title}」主干。`
  )
  let nextEdges = edges.slice()
  if (kind === 'pred') {
    nextEdges = nextEdges.map((edge) => (
      edge.kind === 'flow' && edge.to === host.id ? { ...edge, to: created.id } : edge
    ))
    nextEdges.push({
      id: edgeId,
      from: created.id,
      to: host.id,
      kind: 'flow',
      grow: 'pred',
      reason: edgeReason,
    })
  } else if (kind === 'succ') {
    nextEdges.push({
      id: edgeId,
      from: host.id,
      to: created.id,
      kind: 'flow',
      grow: 'succ',
      reason: edgeReason,
    })
  } else {
    nextEdges.push({
      id: edgeId,
      from: host.id,
      to: created.id,
      kind: 'parallel',
      grow: 'par',
      reason: edgeReason,
    })
  }

  return { nodes: [...nodes, created], edges: nextEdges, created }
}

/** One host keeps exactly one dashed parallel card; extra pals stack their Q&A into it. */
export function collapseParallelHosts(
  nodes: readonly CanvasNode[],
  edges: readonly CanvasEdge[],
): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const keeper = new Map<string, string>()
  const drop = new Map<string, string>()
  const extraTurns = new Map<string, NodeTurn[]>()
  for (const node of nodes) {
    if (node.role !== 'parallel' || !node.hostId) continue
    const keptId = keeper.get(node.hostId)
    if (!keptId) {
      keeper.set(node.hostId, node.id)
      continue
    }
    drop.set(node.id, keptId)
    extraTurns.set(keptId, [...(extraTurns.get(keptId) ?? []), ...node.turns])
  }
  const collapsedNodes = drop.size === 0
    ? nodes.slice()
    : nodes.flatMap((node) => {
      if (drop.has(node.id)) return []
      const extra = extraTurns.get(node.id)
      return extra?.length ? [{ ...node, turns: [...node.turns, ...extra] }] : [node]
    })
  const collapsedEdges = drop.size === 0
    ? edges.slice()
    : edges.filter((edge) => !drop.has(edge.from) && !drop.has(edge.to))
  return { nodes: collapsedNodes, edges: ensureParallelEdges(collapsedNodes, collapsedEdges) }
}

export function mergeConversationBranch(
  root: CanvasNode,
  foreignNodes: readonly CanvasNode[],
  foreignEdges: readonly CanvasEdge[],
  branchNodes: readonly CanvasNode[],
  branchEdges: readonly CanvasEdge[],
) {
  const usedNodes = new Set(['root', ...foreignNodes.map((node) => node.id)])
  const usedEdges = new Set(foreignEdges.map((edge) => edge.id))
  const idMap = new Map<string, string>([['root', 'root']])
  const adopted: CanvasNode[] = []
  for (const node of branchNodes) {
    if (node.id === 'root') continue
    let id = node.id
    if (usedNodes.has(id)) id = nextId('g', usedNodes)
    usedNodes.add(id)
    idMap.set(node.id, id)
    adopted.push({
      ...node,
      id,
      hostId: node.hostId ? idMap.get(node.hostId) || node.hostId : undefined,
    })
  }
  const adoptedEdges = branchEdges.map((edge) => {
    let id = edge.id
    if (usedEdges.has(id)) id = nextId('eg', usedEdges)
    usedEdges.add(id)
    return {
      ...edge,
      id,
      from: idMap.get(edge.from) || edge.from,
      to: idMap.get(edge.to) || edge.to,
    }
  })
  return {
    nodes: [root, ...foreignNodes, ...adopted],
    edges: [...foreignEdges, ...adoptedEdges],
    idMap,
  }
}
