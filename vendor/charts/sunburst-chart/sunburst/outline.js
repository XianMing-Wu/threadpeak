import { innerRadius, outerRadius, polar } from './layout.js'

function arc(from, to, radius, sweep) {
  const [x, y] = polar(to, radius)
  const large = Math.abs(to - from) > Math.PI ? 1 : 0
  return `A${radius},${radius},0,${large},${sweep},${x},${y}`
}

function leavesOf(node, leaves = []) {
  if (!node.children?.length) {
    leaves.push(node)
    return leaves
  }
  node.children.forEach((child) => leavesOf(child, leaves))
  return leaves
}

export function subtreeOutlinePath(selected, scale) {
  const node = selected?.hierarchyNode
  if (!node) return ''

  const inner = Math.max(0.5, innerRadius(node.depth, scale))
  const start = node.x0
  const end = node.x1
  const leaves = leavesOf(node).sort((a, b) => a.x0 - b.x0)
  const [sx, sy] = polar(start, inner)

  let path = `M${sx},${sy}${arc(start, end, inner, 1)}`

  if (!leaves.length) {
    const outer = outerRadius(node.depth, scale)
    const [ex, ey] = polar(end, outer)
    return `${path}L${ex},${ey}${arc(end, start, outer, 0)}Z`
  }

  const last = leaves[leaves.length - 1]
  const [lex, ley] = polar(end, outerRadius(last.depth, scale))
  path += `L${lex},${ley}`

  for (let i = leaves.length - 1; i >= 0; i -= 1) {
    const leaf = leaves[i]
    const radius = outerRadius(leaf.depth, scale)
    const from = i === leaves.length - 1 ? end : leaves[i + 1].x0
    const to = i === 0 ? start : leaf.x0

    if (i < leaves.length - 1) {
      const nextRadius = outerRadius(leaves[i + 1].depth, scale)
      if (Math.abs(nextRadius - radius) > 0.2) {
        const [cx, cy] = polar(leaf.x1, radius)
        path += `L${cx},${cy}`
      }
    }

    path += arc(from, to, radius, 0)
  }

  return `${path}Z`
}
