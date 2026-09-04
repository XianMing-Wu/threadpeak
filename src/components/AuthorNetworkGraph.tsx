import { useEffect, useRef, useState } from 'react'
import {
  NETWORK_KIND_META,
  NETWORK_KIND_ORDER,
  childrenOf,
  neighborIds,
  type AuthorNetworkEdge,
  type AuthorNetworkEdgeKind,
  type AuthorNetworkNode,
} from '../session/project-author-network'

type SimNode = AuthorNetworkNode & { x: number; y: number; vx: number; vy: number; fx?: number; fy?: number }

type View = { x: number; y: number; k: number }

export type AuthorNetworkHighlight = {
  nodeIds: readonly string[]
  edgeIds?: readonly string[]
  focusId?: string
}

const MAX_FORCE = 0.55
const MAX_SPEED = 1.6
const HOME_RADIUS = 42
const PRE_RELAX_TICKS = 80

function restLength(kind: AuthorNetworkEdgeKind) {
  if (kind === 'has-concept') return 86
  if (kind === 'has-question') return 52
  return 36
}

function hashAngle(value: string) {
  return [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 628 / 100
}

function seedLayout(nodes: AuthorNetworkNode[], edges: AuthorNetworkEdge[], width: number, height: number): SimNode[] {
  const placed = new Map<string, { x: number; y: number }>()
  const carriers = nodes.filter((node) => node.kind === 'carrier')
  const cx = width / 2
  const cy = height / 2
  const hubR = Math.min(width, height) * (carriers.length > 6 ? 0.3 : 0.24)

  carriers.forEach((node, index) => {
    const angle = -Math.PI / 2 + (index / Math.max(1, carriers.length)) * Math.PI * 2
    const radius = carriers.length <= 1 ? 0 : hubR
    placed.set(node.id, { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius })
  })

  const ringPlace = (parentId: string, childIds: string[], radius: number) => {
    const parent = placed.get(parentId)
    if (!parent) return
    childIds.forEach((id, index) => {
      if (placed.has(id)) return
      const angle = (index / Math.max(1, childIds.length)) * Math.PI * 2 + hashAngle(id)
      placed.set(id, {
        x: parent.x + Math.cos(angle) * radius,
        y: parent.y + Math.sin(angle) * radius,
      })
    })
  }

  for (const carrier of carriers) {
    ringPlace(carrier.id, childrenOf(carrier.id, edges, 'has-concept'), 86)
  }
  for (const concept of nodes.filter((node) => node.kind === 'concept')) {
    ringPlace(concept.id, childrenOf(concept.id, edges, 'has-question'), 52)
  }

  const hostsOf = new Map<string, string[]>()
  for (const edge of edges) {
    if (edge.kind !== 'authored-at') continue
    const pack = hostsOf.get(edge.source) ?? []
    pack.push(edge.target)
    hostsOf.set(edge.source, pack)
  }
  const authors = nodes.filter((node) => node.kind === 'author')
  authors.forEach((author, index) => {
    const hosts = (hostsOf.get(author.id) ?? []).map((id) => placed.get(id)).filter((point): point is { x: number; y: number } => Boolean(point))
    if (!hosts.length) return
    const x = hosts.reduce((sum, point) => sum + point.x, 0) / hosts.length
    const y = hosts.reduce((sum, point) => sum + point.y, 0) / hosts.length
    const angle = hashAngle(author.id) + index * 0.7
    placed.set(author.id, { x: x + Math.cos(angle) * 20, y: y + Math.sin(angle) * 20 })
  })

  const sim = nodes.map((node, index) => {
    const point = placed.get(node.id)
    return {
      ...node,
      x: point?.x ?? cx + (index % 9 - 4) * 22,
      y: point?.y ?? cy + Math.floor(index / 9) * 20,
      vx: 0,
      vy: 0,
    }
  })

  for (let pass = 0; pass < 6; pass += 1) {
    for (let i = 0; i < sim.length; i += 1) {
      for (let j = i + 1; j < sim.length; j += 1) {
        const a = sim[i]
        const b = sim[j]
        const min = NETWORK_KIND_META[a.kind].radius + NETWORK_KIND_META[b.kind].radius + 8
        let dx = b.x - a.x
        let dy = b.y - a.y
        const dist = Math.hypot(dx, dy) || 0.01
        if (dist >= min) continue
        const push = (min - dist) / 2
        dx = dx / dist * push
        dy = dy / dist * push
        a.x -= dx
        a.y -= dy
        b.x += dx
        b.y += dy
      }
    }
  }
  return sim
}

function clampSpeed(node: SimNode, max = MAX_SPEED) {
  const speed = Math.hypot(node.vx, node.vy)
  if (speed <= max) return
  node.vx = node.vx / speed * max
  node.vy = node.vy / speed * max
}

function worldPoint(view: View, clientX: number, clientY: number, box: DOMRect) {
  return {
    x: (clientX - box.left - view.x) / view.k,
    y: (clientY - box.top - view.y) / view.k,
  }
}

function hitNode(nodes: SimNode[], x: number, y: number) {
  let best: SimNode | null = null
  let bestDist = 18
  for (const node of nodes) {
    const radius = NETWORK_KIND_META[node.kind].radius + 4
    const dist = Math.hypot(node.x - x, node.y - y)
    if (dist <= radius && dist < bestDist) {
      best = node
      bestDist = dist
    }
  }
  return best
}

export function AuthorNetworkGraph({
  nodes,
  edges,
  highlight,
}: {
  nodes: AuthorNetworkNode[]
  edges: AuthorNetworkEdge[]
  highlight?: AuthorNetworkHighlight | null
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const simRef = useRef<SimNode[]>([])
  const viewRef = useRef<View>({ x: 0, y: 0, k: 1 })
  const hoverRef = useRef('')
  const highlightRef = useRef(highlight)
  const paintRef = useRef<() => void>(() => {})
  highlightRef.current = highlight
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; kind: string } | null>(null)

  useEffect(() => {
    const host = hostRef.current
    const svg = svgRef.current
    if (!host || !svg) return undefined

    let width = host.clientWidth || 780
    let height = host.clientHeight || 520
    const previous = new Map(simRef.current.map((node) => [node.id, node]))
    const sim = seedLayout(nodes, edges, width, height).map((node) => {
      const kept = previous.get(node.id)
      return kept ? { ...node, x: kept.x, y: kept.y, vx: 0, vy: 0 } : node
    })
    simRef.current = sim
    const byId = new Map(sim.map((node) => [node.id, node]))
    const home = new Map(sim.map((node) => [node.id, { x: node.x, y: node.y }]))
    if (!previous.size) viewRef.current = { x: 0, y: 0, k: 1 }

    let frame = 0
    let running = true
    let alpha = 0.28
    let dragging = false
    let drag: { pointerId: number; node?: SimNode; lastX: number; lastY: number; moved: boolean } | null = null

    const paint = () => {
      const view = viewRef.current
      const hover = hoverRef.current
      const active = highlightRef.current
      const near = hover ? neighborIds(hover, edges) : null
      const markedNodes = active?.nodeIds.length ? new Set(active.nodeIds) : null
      const markedEdges = active?.edgeIds?.length ? new Set(active.edgeIds) : null
      const lines = edges.map((edge) => {
        const source = byId.get(edge.source)
        const target = byId.get(edge.target)
        if (!source || !target) return ''
        const inHover = !near || near.has(source.id)
        const inMark = !markedNodes || (markedNodes.has(source.id) && markedNodes.has(target.id) && (!markedEdges || markedEdges.has(edge.id)))
        const on = inHover && inMark
        return `<line x1="${source.x}" y1="${source.y}" x2="${target.x}" y2="${target.y}" stroke="${on ? '#c5c9ce' : '#e8eaed'}" stroke-width="${on ? 1 : 0.7}" opacity="${on ? 0.88 : 0.12}"/>`
      }).join('')
      const dots = sim.map((node) => {
        const meta = NETWORK_KIND_META[node.kind]
        const inHover = !near || near.has(node.id)
        const inMark = !markedNodes || markedNodes.has(node.id)
        const focused = active?.focusId === node.id || hover === node.id
        const on = inHover && inMark
        return `<circle data-id="${node.id}" cx="${node.x}" cy="${node.y}" r="${focused ? meta.radius + 1.6 : meta.radius}" fill="${meta.color}" opacity="${on ? 1 : 0.12}" stroke="${focused ? '#111' : 'none'}" stroke-width="${focused ? 1 : 0}"/>`
      }).join('')
      svg.innerHTML = `<g transform="translate(${view.x} ${view.y}) scale(${view.k})"><g class="author-network-edges">${lines}</g><g class="author-network-nodes">${dots}</g></g>`
    }
    paintRef.current = paint

    const integrate = (heat: number) => {
      for (let i = 0; i < sim.length; i += 1) {
        const a = sim[i]
        for (let j = i + 1; j < sim.length; j += 1) {
          const b = sim[j]
          let dx = b.x - a.x
          let dy = b.y - a.y
          const dist = Math.max(14, Math.hypot(dx, dy) || 0.01)
          const force = Math.min(MAX_FORCE, 70 / (dist * dist)) * heat
          dx = dx / dist * force
          dy = dy / dist * force
          const am = NETWORK_KIND_META[a.kind].mass
          const bm = NETWORK_KIND_META[b.kind].mass
          if (a.fx === undefined) { a.vx -= dx / am; a.vy -= dy / am }
          if (b.fx === undefined) { b.vx += dx / bm; b.vy += dy / bm }
        }
      }
      for (const edge of edges) {
        const a = byId.get(edge.source)
        const b = byId.get(edge.target)
        if (!a || !b) continue
        let dx = b.x - a.x
        let dy = b.y - a.y
        const dist = Math.hypot(dx, dy) || 0.01
        const pull = Math.max(-MAX_FORCE, Math.min(MAX_FORCE, (dist - restLength(edge.kind)) * 0.012 * heat))
        dx = dx / dist * pull
        dy = dy / dist * pull
        const am = NETWORK_KIND_META[a.kind].mass
        const bm = NETWORK_KIND_META[b.kind].mass
        if (a.fx === undefined) { a.vx += dx / am; a.vy += dy / am }
        if (b.fx === undefined) { b.vx -= dx / bm; b.vy -= dy / bm }
      }
      for (const node of sim) {
        const origin = home.get(node.id)
        if (node.fx !== undefined) {
          node.x = node.fx
          node.y = node.fy ?? node.y
          node.vx = 0
          node.vy = 0
          if (origin) { origin.x = node.x; origin.y = node.y }
          continue
        }
        if (origin) {
          const hx = origin.x - node.x
          const hy = origin.y - node.y
          const hd = Math.hypot(hx, hy)
          node.vx += hx * 0.05
          node.vy += hy * 0.05
          if (hd > HOME_RADIUS) {
            node.x = origin.x - hx / hd * HOME_RADIUS
            node.y = origin.y - hy / hd * HOME_RADIUS
            node.vx *= 0.2
            node.vy *= 0.2
          }
        }
        node.vx += (width / 2 - node.x) * 0.0014
        node.vy += (height / 2 - node.y) * 0.0014
        node.vx *= 0.82
        node.vy *= 0.82
        clampSpeed(node)
        node.x += node.vx
        node.y += node.vy
      }
    }

    const wake = (heat = 0.12) => {
      alpha = Math.max(alpha, heat)
      if (!frame && running) frame = window.requestAnimationFrame(loop)
    }

    const loop = () => {
      if (!running) return
      frame = 0
      if (alpha > 0.01 || dragging) {
        integrate(alpha)
        if (!dragging) alpha *= 0.94
        paint()
        frame = window.requestAnimationFrame(loop)
      } else {
        paint()
      }
    }

    for (let i = 0; i < PRE_RELAX_TICKS; i += 1) integrate(0.22 * (1 - i / PRE_RELAX_TICKS))
    for (const node of sim) {
      node.vx = 0
      node.vy = 0
      home.set(node.id, { x: node.x, y: node.y })
    }
    paint()
    wake(0.16)

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      const box = svg.getBoundingClientRect()
      const point = worldPoint(viewRef.current, event.clientX, event.clientY, box)
      const node = hitNode(sim, point.x, point.y)
      svg.setPointerCapture(event.pointerId)
      dragging = true
      drag = { pointerId: event.pointerId, node: node ?? undefined, lastX: event.clientX, lastY: event.clientY, moved: false }
      if (node) {
        node.fx = node.x
        node.fy = node.y
        node.vx = 0
        node.vy = 0
      }
      wake(0.08)
      paint()
    }
    const onPointerMove = (event: PointerEvent) => {
      const box = svg.getBoundingClientRect()
      const point = worldPoint(viewRef.current, event.clientX, event.clientY, box)
      if (!drag || drag.pointerId !== event.pointerId) {
        const node = hitNode(sim, point.x, point.y)
        const nextId = node?.id ?? ''
        if (hoverRef.current !== nextId) {
          hoverRef.current = nextId
          setTooltip(node ? {
            x: event.clientX - box.left,
            y: event.clientY - box.top,
            label: node.label,
            kind: NETWORK_KIND_META[node.kind].label,
          } : null)
        } else if (node) {
          setTooltip((current) => current ? { ...current, x: event.clientX - box.left, y: event.clientY - box.top } : current)
        }
        paint()
        return
      }
      drag.moved = drag.moved || Math.hypot(event.clientX - drag.lastX, event.clientY - drag.lastY) > 2
      if (drag.node) {
        drag.node.fx = point.x
        drag.node.fy = point.y
        drag.node.x = point.x
        drag.node.y = point.y
      } else {
        viewRef.current.x += event.clientX - drag.lastX
        viewRef.current.y += event.clientY - drag.lastY
        drag.lastX = event.clientX
        drag.lastY = event.clientY
      }
      paint()
    }
    const onPointerUp = (event: PointerEvent) => {
      if (!drag || drag.pointerId !== event.pointerId) return
      if (drag.node) {
        const origin = home.get(drag.node.id)
        if (origin) {
          origin.x = drag.node.x
          origin.y = drag.node.y
        }
        drag.node.fx = undefined
        drag.node.fy = undefined
        drag.node.vx = 0
        drag.node.vy = 0
      }
      if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId)
      drag = null
      dragging = false
      wake(0.06)
      paint()
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const box = svg.getBoundingClientRect()
      const view = viewRef.current
      const next = Math.min(2.6, Math.max(0.35, view.k * (event.deltaY < 0 ? 1.12 : 1 / 1.12)))
      const point = worldPoint(view, event.clientX, event.clientY, box)
      view.k = next
      view.x = event.clientX - box.left - point.x * next
      view.y = event.clientY - box.top - point.y * next
      paint()
    }
    const onResize = () => {
      width = host.clientWidth || width
      height = host.clientHeight || height
    }

    const observer = new ResizeObserver(onResize)
    observer.observe(host)
    svg.addEventListener('pointerdown', onPointerDown)
    svg.addEventListener('pointermove', onPointerMove)
    svg.addEventListener('pointerup', onPointerUp)
    svg.addEventListener('pointercancel', onPointerUp)
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      running = false
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      svg.removeEventListener('pointerdown', onPointerDown)
      svg.removeEventListener('pointermove', onPointerMove)
      svg.removeEventListener('pointerup', onPointerUp)
      svg.removeEventListener('pointercancel', onPointerUp)
      svg.removeEventListener('wheel', onWheel)
    }
  }, [nodes, edges])

  useEffect(() => {
    highlightRef.current = highlight
    paintRef.current()
  }, [highlight])

  return (
    <div ref={hostRef} className="author-network-graph" aria-label="博主网络图谱">
      <ul className="author-network-legend">
        {NETWORK_KIND_ORDER.map((kind) => (
          <li key={kind}><i style={{ background: NETWORK_KIND_META[kind].color }}/><span>{NETWORK_KIND_META[kind].label}</span></li>
        ))}
      </ul>
      <svg ref={svgRef} className="author-network-canvas" role="img" aria-label="博主与知识的关系图"/>
      {tooltip && (
        <div className="author-network-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <small>{tooltip.kind}</small>
          <b>{tooltip.label}</b>
        </div>
      )}
    </div>
  )
}
