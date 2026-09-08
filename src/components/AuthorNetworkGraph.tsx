import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import './author-network-graph.css'
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
  onSelect,
  describedBy,
}: {
  nodes: AuthorNetworkNode[]
  edges: AuthorNetworkEdge[]
  onSelect?: (node:AuthorNetworkNode)=>void
  highlight?: AuthorNetworkHighlight | null
  describedBy?: string
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const viewportRef = useRef<SVGGElement>(null)
  const nodeRefs = useRef(new Map<string, SVGCircleElement>())
  const edgeRefs = useRef(new Map<string, SVGLineElement>())
  const instructionsId = useId()
  const simRef = useRef<SimNode[]>([])
  const viewRef = useRef<View>({ x: 0, y: 0, k: 1 })
  const hoverRef = useRef('')
  const focusRef = useRef('')
  const selectedRef = useRef('')
  const [selectedId, setSelectedId] = useState('')
  const highlightRef = useRef(highlight)
  const paintRef = useRef<() => void>(() => {})
  const selectRef = useRef(onSelect)
  selectRef.current = onSelect
  highlightRef.current = highlight
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; kind: string } | null>(null)

  const selectNode = (node: AuthorNetworkNode) => {
    hoverRef.current = ''
    selectedRef.current = node.id
    setSelectedId(node.id)
    paintRef.current()
    selectRef.current?.(node)
  }

  const showFocusedNode = (node: AuthorNetworkNode) => {
    hoverRef.current = ''
    focusRef.current = node.id
    const position = simRef.current.find((candidate) => candidate.id === node.id)
    if (position) {
      const view = viewRef.current
      setTooltip({ x: position.x * view.k + view.x, y: position.y * view.k + view.y, label: node.label, kind: NETWORK_KIND_META[node.kind].label })
    }
    paintRef.current()
  }

  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    const view = viewRef.current
    const distance = event.shiftKey ? 80 : 40
    if (event.key === 'ArrowLeft') view.x -= distance
    else if (event.key === 'ArrowRight') view.x += distance
    else if (event.key === 'ArrowUp') view.y -= distance
    else if (event.key === 'ArrowDown') view.y += distance
    else if (event.key === '+' || event.key === '=' || event.key === '-') {
      const width = hostRef.current?.clientWidth || 780
      const height = hostRef.current?.clientHeight || 520
      const scale = Math.min(2.6, Math.max(0.35, view.k * (event.key === '-' ? 1 / 1.12 : 1.12)))
      view.x = width / 2 - (width / 2 - view.x) * scale / view.k
      view.y = height / 2 - (height / 2 - view.y) * scale / view.k
      view.k = scale
    } else if (event.key === '0') viewRef.current = { x: 0, y: 0, k: 1 }
    else if (event.key === 'Enter' && event.target === event.currentTarget) {
      const node = nodes.find((candidate) => candidate.id === selectedRef.current) ?? nodes[0]
      if (node) {
        nodeRefs.current.get(node.id)?.focus()
        selectNode(node)
      }
    } else return
    event.preventDefault()
    hoverRef.current = ''
    const focused = nodes.find((node) => node.id === focusRef.current)
    if (focused) showFocusedNode(focused)
    else { setTooltip(null); paintRef.current() }
  }

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
    if (focusRef.current && !sim.some((node) => node.id === focusRef.current)) {
      focusRef.current = ''
      setTooltip(null)
      if (document.activeElement === document.body) svg.focus()
    }
    if (hoverRef.current && !sim.some((node) => node.id === hoverRef.current)) {
      hoverRef.current = ''
      setTooltip(null)
    }
    const byId = new Map(sim.map((node) => [node.id, node]))
    const home = new Map(sim.map((node) => [node.id, { x: node.x, y: node.y }]))
    if (!previous.size) viewRef.current = { x: 0, y: 0, k: 1 }

    let frame = 0
    let running = true
    let alpha = 0.28
    let dragging = false
    let drag: { pointerId: number; node?: SimNode; lastX: number; lastY: number; moved: boolean } | null = null
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reducedMotion = motionQuery.matches

    const paint = () => {
      const view = viewRef.current
      const hover = hoverRef.current || focusRef.current
      const active = highlightRef.current
      const near = hover ? neighborIds(hover, edges) : null
      const markedNodes = active?.nodeIds.length ? new Set(active.nodeIds) : null
      const markedEdges = active?.edgeIds?.length ? new Set(active.edgeIds) : null
      viewportRef.current?.setAttribute('transform', `translate(${view.x} ${view.y}) scale(${view.k})`)
      // React owns stable, focusable SVG elements; the simulation only paints their geometry.
      for (const edge of edges) {
        const source = byId.get(edge.source)
        const target = byId.get(edge.target)
        const element = edgeRefs.current.get(edge.id)
        if (!source || !target || !element) continue
        const inHover = !near || near.has(source.id)
        const inMark = !markedNodes || (markedNodes.has(source.id) && markedNodes.has(target.id) && (!markedEdges || markedEdges.has(edge.id)))
        const on = inHover && inMark
        element.setAttribute('x1', String(source.x))
        element.setAttribute('y1', String(source.y))
        element.setAttribute('x2', String(target.x))
        element.setAttribute('y2', String(target.y))
        element.setAttribute('stroke', on ? '#c5c9ce' : '#e8eaed')
        element.setAttribute('stroke-width', on ? '1' : '0.7')
        element.setAttribute('opacity', on ? '0.88' : '0.12')
      }
      for (const node of sim) {
        const element = nodeRefs.current.get(node.id)
        if (!element) continue
        const meta = NETWORK_KIND_META[node.kind]
        const inHover = !near || near.has(node.id)
        const inMark = !markedNodes || markedNodes.has(node.id)
        const focused = active?.focusId === node.id || hover === node.id || selectedRef.current === node.id
        const on = focusRef.current === node.id || (inHover && inMark)
        element.setAttribute('cx', String(node.x))
        element.setAttribute('cy', String(node.y))
        element.setAttribute('r', String(focused ? meta.radius + 1.6 : meta.radius))
        element.setAttribute('opacity', on ? '1' : '0.12')
        element.setAttribute('stroke', focused ? '#111' : 'none')
        element.setAttribute('stroke-width', focused ? '1' : '0')
      }
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
      if (!frame && running && !reducedMotion) frame = window.requestAnimationFrame(loop)
    }

    const loop = () => {
      if (!running) return
      frame = 0
      if (reducedMotion) { paint(); return }
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
      const target = event.target instanceof Element ? event.target.closest('[data-id]') : null
      const node = byId.get(target?.getAttribute('data-id') ?? '') ?? hitNode(sim, point.x, point.y)
      if (node) nodeRefs.current.get(node.id)?.focus({ preventScroll: true })
      else svg.focus({ preventScroll: true })
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
      if (drag.node && !drag.moved && event.type !== 'pointercancel') {
        selectedRef.current = drag.node.id
        setSelectedId(drag.node.id)
        selectRef.current?.(drag.node)
      }
      if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId)
      drag = null
      dragging = false
      wake(0.06)
      paint()
    }
    const onPointerLeave = () => {
      if (drag) return
      hoverRef.current = ''
      const focused = byId.get(focusRef.current)
      const view = viewRef.current
      setTooltip(focused ? { x: focused.x * view.k + view.x, y: focused.y * view.k + view.y, label: focused.label, kind: NETWORK_KIND_META[focused.kind].label } : null)
      paint()
    }
    const onWheel = (event: WheelEvent) => {
      // Let ordinary wheel/trackpad scrolling reach the containing page.
      if (!event.ctrlKey && !event.metaKey) return
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
    const onMotionChange = () => {
      reducedMotion = motionQuery.matches
      if (reducedMotion) {
        window.cancelAnimationFrame(frame)
        frame = 0
      } else wake(0.08)
    }

    const observer = new ResizeObserver(onResize)
    observer.observe(host)
    motionQuery.addEventListener('change', onMotionChange)
    svg.addEventListener('pointerdown', onPointerDown)
    svg.addEventListener('pointermove', onPointerMove)
    svg.addEventListener('pointerup', onPointerUp)
    svg.addEventListener('pointercancel', onPointerUp)
    svg.addEventListener('pointerleave', onPointerLeave)
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      running = false
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      motionQuery.removeEventListener('change', onMotionChange)
      if (drag && svg.hasPointerCapture(drag.pointerId)) svg.releasePointerCapture(drag.pointerId)
      if (paintRef.current === paint) paintRef.current = () => {}
      svg.removeEventListener('pointerdown', onPointerDown)
      svg.removeEventListener('pointermove', onPointerMove)
      svg.removeEventListener('pointerup', onPointerUp)
      svg.removeEventListener('pointercancel', onPointerUp)
      svg.removeEventListener('pointerleave', onPointerLeave)
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
      <p id={instructionsId} className="author-network-instructions">Tab 切换节点，Enter 或空格选择。方向键平移，按住 Shift 加快；加减键缩放，0 复位。也可从来源作者列表查看资料。</p>
      <svg ref={svgRef} className="author-network-canvas" role="group" tabIndex={0} aria-label="博主与知识的关系图" aria-describedby={[instructionsId, describedBy].filter(Boolean).join(' ')} onKeyDown={onKeyDown}>
        <g ref={viewportRef}>
          <g className="author-network-edges" aria-hidden="true">
            {edges.map((edge) => <line key={edge.id} ref={(element) => { if (element) edgeRefs.current.set(edge.id, element); else edgeRefs.current.delete(edge.id) }}/>) }
          </g>
          <g className="author-network-nodes">
            {nodes.map((node) => (
              <circle key={node.id} ref={(element) => { if (element) nodeRefs.current.set(node.id, element); else nodeRefs.current.delete(node.id) }} data-id={node.id} fill={NETWORK_KIND_META[node.kind].color}
                role="button" tabIndex={0} aria-label={`${NETWORK_KIND_META[node.kind].label}：${node.label}`} aria-pressed={selectedId === node.id}
                onFocus={() => showFocusedNode(node)} onBlur={() => { focusRef.current = ''; setTooltip(null); paintRef.current() }}
                onClick={(event) => { if (event.detail === 0) selectNode(node) }}
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); if (!event.repeat) { showFocusedNode(node); selectNode(node) } } }}>
                <title>{node.label}{node.detail ? `，${node.detail}` : ''}</title>
              </circle>
            ))}
          </g>
        </g>
      </svg>
      {tooltip && (
        <div className="author-network-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <small>{tooltip.kind}</small>
          <b>{tooltip.label}</b>
        </div>
      )}
    </div>
  )
}
