/**
 * Knowledge-canvas layout, linking, and movement — the same contract as
 * thread-chatbot's use-canvas-layout + canvas-node Handles, without React Flow.
 *
 * · rankdir LR: root on the left, children to the right
 * · edges attach to hidden handles (source = right, target = left)
 * · dagre-style coordinates: layout gives centers, we store top-left
 * · pin overrides keep a dragged node still while siblings reflow
 */

export const CARD_W = 300
export const CARD_H = 148
/** Vertical gap between sibling cards (absorbs height error, same role as dagre nodesep). */
export const NODE_SEP = 40
/** Horizontal gap between ranks (same role as dagre ranksep). */
export const RANK_SEP = 110
export const MARGIN_X = 24
export const MARGIN_Y = 24
/** Gap under a host card before its parallel stack. */
export const PARALLEL_GAP = 28
/** Visible card cap; longer replies scroll inside the node. */
export const MAX_CARD_H = 280

export type LayoutNode = { id: string; role?: 'flow' | 'parallel'; hostId?: string }
export type LayoutEdge = { from: string; to: string; kind?: 'flow' | 'parallel' }

export type Size = { width: number; height: number }
export type XY = { x: number; y: number }

export const DEFAULT_SIZE: Size = { width: CARD_W, height: CARD_H }

export function sizeOf(
  id: string,
  sizes: ReadonlyMap<string, Size> | undefined,
): Size {
  return sizes?.get(id) ?? DEFAULT_SIZE
}

function palsOf(
  id: string,
  nodes: readonly LayoutNode[],
): LayoutNode[] {
  return nodes.filter((node) => node.role === 'parallel' && node.hostId === id)
}

function hangingHeight(
  id: string,
  nodes: readonly LayoutNode[],
  sizes?: ReadonlyMap<string, Size>,
): number {
  const pal = palsOf(id, nodes)[0]
  if (!pal) return 0
  return PARALLEL_GAP + sizeOf(pal.id, sizes).height
}

function flowChildrenOf(
  edges: readonly LayoutEdge[],
  flowIds: readonly string[],
): Map<string, string[]> {
  const children = new Map<string, string[]>()
  const known = new Set(flowIds)
  for (const id of flowIds) children.set(id, [])
  for (const edge of edges) {
    if (edge.kind === 'parallel' || !known.has(edge.from) || !known.has(edge.to)) continue
    children.get(edge.from)?.push(edge.to)
  }
  return children
}

function shiftFlowFamily(
  id: string,
  dy: number,
  out: Map<string, XY>,
  children: ReadonlyMap<string, string[]>,
) {
  const stack = [id]
  const seen = new Set<string>()
  while (stack.length) {
    const current = stack.pop()!
    if (seen.has(current)) continue
    seen.add(current)
    const point = out.get(current)
    if (point) out.set(current, { x: point.x, y: point.y + dy })
    for (const kid of children.get(current) ?? []) stack.push(kid)
  }
}

function placeParallels(
  out: Map<string, XY>,
  nodes: readonly LayoutNode[],
  sizes?: ReadonlyMap<string, Size>,
) {
  for (const host of nodes) {
    if (host.role === 'parallel') continue
    const pals = palsOf(host.id, nodes)
    if (!pals.length) continue
    const hostPos = out.get(host.id)
    if (!hostPos) continue
    const pal = pals[0]
    out.set(pal.id, {
      x: hostPos.x,
      y: hostPos.y + sizeOf(host.id, sizes).height + PARALLEL_GAP,
    })
  }
}

function overlaps(
  a: XY,
  aSize: Size,
  b: XY,
  bSize: Size,
  gap: number,
): boolean {
  return a.x < b.x + bSize.width && b.x < a.x + aSize.width
    && a.y < b.y + bSize.height + gap && b.y < a.y + aSize.height + gap
}

function resolveOverlaps(
  out: Map<string, XY>,
  nodes: readonly LayoutNode[],
  children: ReadonlyMap<string, string[]>,
  sizes?: ReadonlyMap<string, Size>,
) {
  const roleOf = new Map(nodes.map((node) => [node.id, node.role ?? 'flow']))
  const hostOf = new Map(nodes.filter((node) => node.hostId).map((node) => [node.id, node.hostId!]))
  for (let pass = 0; pass < 24; pass += 1) {
    placeParallels(out, nodes, sizes)
    const ids = nodes.map((node) => node.id).filter((id) => out.has(id))
    let moved = false
    for (const upperId of ids) {
      const upper = out.get(upperId)
      if (!upper) continue
      const upperSize = sizeOf(upperId, sizes)
      for (const lowerId of ids) {
        if (upperId === lowerId || hostOf.get(lowerId) === upperId) continue
        const lower = out.get(lowerId)
        if (!lower || lower.y < upper.y) continue
        if (!overlaps(upper, upperSize, lower, sizeOf(lowerId, sizes), NODE_SEP)) continue
        if (roleOf.get(lowerId) === 'parallel') continue
        const nextY = upper.y + upperSize.height + NODE_SEP
        const dy = nextY - lower.y
        if (dy <= 0.5) continue
        shiftFlowFamily(lowerId, dy, out, children)
        moved = true
      }
    }
    if (!moved) break
  }
  placeParallels(out, nodes, sizes)
}

export function layoutPositions(
  nodes: readonly LayoutNode[],
  edges: readonly LayoutEdge[],
  sizes?: ReadonlyMap<string, Size>,
): Map<string, XY> {
  const flowNodes = nodes.filter((node) => node.role !== 'parallel')
  const flowIds = flowNodes.map((node) => node.id)
  const children = flowChildrenOf(edges, flowIds)
  const parentOf = new Map<string, string>()
  for (const [from, kids] of children) {
    for (const kid of kids) parentOf.set(kid, from)
  }
  const roots = flowIds.filter((id) => !parentOf.has(id))
  const centers = new Map<string, XY>()

  /**
   * Slot height for a flow node, including a dashed card that may hang
   * under it. The host is still centered on its LR children (thread-chatbot),
   * so hanging is measured from that centered box, not from the slot top.
   */
  const subtreeHeight = (id: string): number => {
    const kids = children.get(id) ?? []
    const self = sizeOf(id, sizes).height
    const hang = hangingHeight(id, nodes, sizes)
    if (!kids.length) return self + hang
    const childSpan = kids.reduce(
      (sum, kid, index) => sum + subtreeHeight(kid) + (index ? NODE_SEP : 0),
      0,
    )
    const hangBottom = childSpan / 2 + self / 2 + hang
    return Math.max(childSpan, self + hang, hangBottom)
  }

  const place = (id: string, centerX: number, top: number) => {
    const kids = children.get(id) ?? []
    const size = sizeOf(id, sizes)
    if (!kids.length) {
      centers.set(id, { x: centerX, y: top + size.height / 2 })
      return
    }
    let y = top
    for (const kid of kids) {
      const kidSize = sizeOf(kid, sizes)
      place(kid, centerX + size.width / 2 + RANK_SEP + kidSize.width / 2, y)
      y += subtreeHeight(kid) + NODE_SEP
    }
    const first = centers.get(kids[0])
    const last = centers.get(kids[kids.length - 1])
    const midY = first && last ? (first.y + last.y) / 2 : top + size.height / 2
    centers.set(id, { x: centerX, y: midY })
  }

  let top = MARGIN_Y
  for (const root of roots) {
    const size = sizeOf(root, sizes)
    place(root, MARGIN_X + size.width / 2, top)
    top += subtreeHeight(root) + NODE_SEP
  }

  const out = new Map<string, XY>()
  let minX = Infinity
  let minY = Infinity
  for (const id of flowIds) {
    const center = centers.get(id) ?? { x: MARGIN_X, y: MARGIN_Y }
    const size = sizeOf(id, sizes)
    const topLeft = { x: center.x - size.width / 2, y: center.y - size.height / 2 }
    out.set(id, topLeft)
    minX = Math.min(minX, topLeft.x)
    minY = Math.min(minY, topLeft.y)
  }
  const dx = MARGIN_X - minX
  const dy = MARGIN_Y - minY
  if (dx !== 0 || dy !== 0) {
    for (const [id, point] of out) out.set(id, { x: point.x + dx, y: point.y + dy })
  }
  resolveOverlaps(out, nodes, children, sizes)
  return out
}

export function worldSize(
  positions: ReadonlyMap<string, XY>,
  sizes?: ReadonlyMap<string, Size>,
): Size {
  let maxX = 320
  let maxY = 240
  for (const [id, point] of positions) {
    const size = sizeOf(id, sizes)
    maxX = Math.max(maxX, point.x + size.width)
    maxY = Math.max(maxY, point.y + size.height)
  }
  return { width: Math.ceil(maxX + MARGIN_X), height: Math.ceil(maxY + MARGIN_Y) }
}

/** Right-edge midpoint — React Flow Position.Right source handle. */
export function sourceHandle(position: XY, size: Size): XY {
  return { x: position.x + size.width, y: position.y + size.height / 2 }
}

/** Left-edge midpoint — React Flow Position.Left target handle. */
export function targetHandle(position: XY, size: Size): XY {
  return { x: position.x, y: position.y + size.height / 2 }
}

export function bezierLR(from: XY, to: XY): string {
  const mx = (from.x + to.x) / 2
  return `M${from.x} ${from.y} C${mx} ${from.y},${mx} ${to.y},${to.x} ${to.y}`
}

export function bottomHandle(position: XY, size: Size): XY {
  return { x: position.x + size.width / 2, y: position.y + size.height }
}

export function topHandle(position: XY, size: Size): XY {
  return { x: position.x + size.width / 2, y: position.y }
}

/** Bottom → top cubic. Aligned hosts stay a vertical dash; a dragged card bends the wire. */
export function dashedTB(from: XY, to: XY): string {
  const my = (from.y + to.y) / 2
  return `M${from.x} ${from.y} C${from.x} ${my},${to.x} ${my},${to.x} ${to.y}`
}
