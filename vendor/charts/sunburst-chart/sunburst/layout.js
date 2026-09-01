import { CONFIG } from './config.js'

const TWO_PI = Math.PI * 2

export function innerRadius(depth, scale) {
  return depth * CONFIG.ringUnit * scale
}

export function outerRadius(depth, scale) {
  return ((depth + 1) * CONFIG.ringUnit - CONFIG.ringGap) * scale
}

export function polar(angle, radius) {
  const theta = angle + CONFIG.angleOffset
  return [Math.sin(theta) * radius, -Math.cos(theta) * radius]
}

function buildTree(data, depth = 0) {
  const children = (data.children ?? []).map((child) => buildTree(child, depth + 1))
  const height = children.length ? 1 + Math.max(...children.map((child) => child.height)) : 0
  return { data, depth, height, children, x0: 0, x1: 0 }
}

function flatten(node, list = []) {
  list.push(node)
  node.children.forEach((child) => flatten(child, list))
  return list
}

function containsId(node, id) {
  if (node.data.id === id) return true
  return node.children.some((child) => containsId(child, id))
}

function findById(node, id) {
  return flatten(node).find((item) => item.data.id === id) ?? null
}

function topReservedAngle(focusNode) {
  if (!focusNode || focusNode.depth === 0) return 0
  let angle = CONFIG.selectedTopAngle
  if (focusNode.depth > 1) angle += (focusNode.depth - 1) * 0.2
  return Math.min(angle, CONFIG.selectedMaxAngle)
}

/** Angular width per child: the branch holding the focus takes more, siblings share the rest. */
function siblingWidths(node, span, focusId, focusNode) {
  const kids = node.children
  const count = kids.length
  if (!count) return []

  const selectedIndex = focusId
    ? kids.findIndex((child) => containsId(child, focusId))
    : -1

  if (selectedIndex < 0) return kids.map(() => span / count)

  if (node.depth === 0) {
    if (count === 1) return [span]
    const reserved = Math.min(topReservedAngle(focusNode), span * 0.92)
    const rest = (span - reserved) / (count - 1)
    return kids.map((_, index) => (index === selectedIndex ? reserved : rest))
  }

  const multiplier = CONFIG.selectedDeepMultiplier
  const unit = span / (count + multiplier - 1)
  return kids.map((_, index) => (index === selectedIndex ? unit * multiplier : unit))
}

function assignAngles(node, x0, x1, focusId, focusNode) {
  node.x0 = x0
  node.x1 = x1
  if (!node.children.length) return
  const widths = siblingWidths(node, x1 - x0, focusId, focusNode)
  let cursor = x0
  node.children.forEach((child, index) => {
    assignAngles(child, cursor, cursor + widths[index], focusId, focusNode)
    cursor += widths[index]
  })
}

function padded(depth, x0, x1) {
  if (depth === 0) return [x0, x1]
  const pad = Math.min(CONFIG.padAngle / 2, Math.max(0, x1 - x0) * 0.14)
  return [x0 + pad, x1 - pad]
}

function segmentPath(depth, x0, x1, scale) {
  const inner = innerRadius(depth, scale)
  const outer = outerRadius(depth, scale)
  const [a0, a1] = padded(depth, x0, x1)
  if (a1 <= a0) return ''

  if (depth === 0) {
    const [x, y] = polar(0, outer)
    return `M${x},${y}A${outer},${outer},0,1,1,${-x},${-y}A${outer},${outer},0,1,1,${x},${y}Z`
  }

  const [ox0, oy0] = polar(a0, outer)
  const [ox1, oy1] = polar(a1, outer)
  const [ix1, iy1] = polar(a1, inner)
  const [ix0, iy0] = polar(a0, inner)
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `M${ox0},${oy0}A${outer},${outer},0,${large},1,${ox1},${oy1}L${ix1},${iy1}A${inner},${inner},0,${large},0,${ix0},${iy0}Z`
}

function centroid(depth, x0, x1, scale) {
  if (depth === 0) return [0, 0]
  const radius = (innerRadius(depth, scale) + outerRadius(depth, scale)) / 2
  return polar((x0 + x1) / 2, radius)
}

/** Flat, render-ready segments. `hierarchyNode` is what outline.js walks. */
function toNodes(root, scale) {
  return flatten(root).map((node) => ({
    id: node.data.id,
    stance: node.data.stance,
    impact: node.data.impact ?? 2,
    text: node.data.text,
    depth: node.depth,
    x0: node.x0,
    x1: node.x1,
    path: segmentPath(node.depth, node.x0, node.x1, scale),
    centroid: centroid(node.depth, node.x0, node.x1, scale),
    hierarchyNode: node,
  }))
}

export function layoutSunburst(data, radius, focusId = null) {
  const root = buildTree(data)
  const focus = focusId && focusId !== data.id ? findById(root, focusId) : null
  assignAngles(root, 0, TWO_PI, focus ? focusId : null, focus)

  const maxOuter = (root.height + 1) * CONFIG.ringUnit - CONFIG.ringGap
  const scale = radius / Math.max(maxOuter, 1)
  return { root, nodes: toNodes(root, scale), scale }
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

export function easeOutCubic(t) {
  return 1 - (1 - t) ** 3
}

/** Blend two layouts at `t`, then rebuild paths from the blended angles. */
export function interpolateLayouts(fromLayout, toLayout, t) {
  if (!fromLayout) return toLayout

  const previous = new Map(fromLayout.nodes.map((node) => [node.id, node]))
  const scale = lerp(fromLayout.scale, toLayout.scale, t)

  const blend = (node) => {
    const before = previous.get(node.data.id)
    return {
      data: node.data,
      depth: node.depth,
      x0: lerp(before?.x0 ?? node.x0, node.x0, t),
      x1: lerp(before?.x1 ?? node.x1, node.x1, t),
      children: node.children.map(blend),
    }
  }

  const root = blend(toLayout.root)
  return { root, nodes: toNodes(root, scale), scale }
}

export function findNode(nodes, id) {
  return nodes.find((node) => node.id === id) ?? nodes[0]
}
