import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { CONFIG } from './config.js'
import { INK, PAPER, segmentFill } from './colors.js'
import { easeOutCubic, findNode, interpolateLayouts, layoutSunburst } from './layout.js'
import { subtreeOutlinePath } from './outline.js'

function useSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const node = ref.current
    if (!node) return undefined
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [ref])

  return size
}

function FocusMarker({ x, y, scale }) {
  const outer = 8 * scale
  return (
    <g className="sunburst__marker" transform={`translate(${x}, ${y})`} pointerEvents="none">
      <circle r={outer} fill={INK} />
      <circle r={outer * 0.75} fill="#fff" />
      <circle r={outer * 0.375} fill={INK} />
    </g>
  )
}

function Outline({ d, scale }) {
  if (!d) return null
  return (
    <g className="sunburst__outline" pointerEvents="none">
      <path d={d} fill="none" stroke={INK} strokeWidth={3 * scale} strokeLinejoin="round" />
      <path d={d} fill="none" stroke={PAPER} strokeWidth={1.5 * scale} strokeLinejoin="round" />
    </g>
  )
}

function placeCallout(originX, originY, viewW, viewH, cx, radius) {
  const width = CONFIG.calloutWidth
  const margin = CONFIG.calloutMargin
  const gap = 28
  const onRight = originX <= cx
  let x = onRight ? cx + radius + gap : cx - radius - gap - width
  x = Math.min(viewW - margin - width, Math.max(margin, x))
  const y = Math.min(viewH - margin - 80, Math.max(margin, originY + CONFIG.calloutDrop))
  return { x, y, width }
}

function CalloutLeader({ fromX, fromY, box, scale, markerId }) {
  const toX = box.x + box.width / 2
  const inset = 8 * scale + 2
  const startX = fromX + (toX >= fromX ? inset : -inset)
  return (
    <g className="sunburst__leader" pointerEvents="none">
      <defs>
        <marker id={markerId} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill={INK} />
        </marker>
      </defs>
      <path
        className="sunburst__leader-line"
        d={`M${startX},${fromY}H${toX}V${box.y}`}
        fill="none"
        stroke={INK}
        strokeWidth={1.5}
        markerEnd={`url(#${markerId})`}
      />
    </g>
  )
}

/**
 * Reusable zoomable-angle sunburst.
 *
 * data shape: { id, text, stance, impact?, children? }
 */
export function Sunburst({ data, selectedId, onSelect, callout }) {
  const viewportRef = useRef(null)
  const displayedRef = useRef(null)
  const arrowId = `sunburst-arrow-${useId().replace(/:/g, '')}`
  const { width, height } = useSize(viewportRef)
  const [hoveredId, setHoveredId] = useState(null)
  const [tooltip, setTooltip] = useState(null)
  const [displayed, setDisplayed] = useState(null)

  const radius = Math.max(40, Math.min(width, height) / 2 - CONFIG.padding)
  const cx = width / 2
  const cy = height / 2

  const target = useMemo(() => {
    if (!width) return null
    return layoutSunburst(data, radius, selectedId)
  }, [data, radius, selectedId, width])

  useEffect(() => {
    if (!target) return undefined
    const from = displayedRef.current
    const duration = from ? CONFIG.tweenMs : 0
    const start = performance.now()
    let frame = 0

    const paint = (t) => {
      const layout = interpolateLayouts(from, target, t)
      displayedRef.current = t === 1 ? target : layout
      setDisplayed(layout)
    }

    if (!duration) {
      paint(1)
      return undefined
    }

    paint(0)
    const tick = (now) => {
      const t = easeOutCubic(Math.min(1, (now - start) / duration))
      paint(t)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target])

  const selected = displayed ? findNode(displayed.nodes, selectedId) : null
  const outline = selected && displayed ? subtreeOutlinePath(selected, displayed.scale) : ''
  const origin = selected && width ? [cx + selected.centroid[0], cy + selected.centroid[1]] : null
  const box = origin ? placeCallout(origin[0], origin[1], width, height, cx, radius) : null

  function moveTip(event, node) {
    const box = viewportRef.current.getBoundingClientRect()
    setTooltip({
      x: event.clientX - box.left,
      y: event.clientY - box.top,
      text: node.text,
    })
  }

  return (
    <div className="sunburst" ref={viewportRef}>
      <svg className="sunburst__svg" width={width} height={height} role="img" aria-label="Discussion sunburst">
        <g transform={`translate(${cx}, ${cy})`}>
          {displayed?.nodes.map((node) => (
            <path
              key={node.id}
              className="sunburst__segment"
              d={node.path}
              fill={segmentFill(node.stance, node.impact)}
              fillOpacity={node.id === selectedId || node.id === hoveredId ? 0.7 : 1}
              onPointerEnter={(event) => {
                setHoveredId(node.id)
                moveTip(event, node)
              }}
              onPointerMove={(event) => moveTip(event, node)}
              onPointerLeave={() => {
                setHoveredId(null)
                setTooltip(null)
              }}
              onPointerDown={() => onSelect(node.id)}
            />
          ))}
          <Outline d={outline} scale={displayed?.scale ?? 1} />
          {selected ? (
            <FocusMarker
              x={selected.centroid[0]}
              y={selected.centroid[1]}
              scale={displayed.scale}
            />
          ) : null}
        </g>
        {callout && origin && box ? (
          <CalloutLeader
            fromX={origin[0]}
            fromY={origin[1]}
            box={box}
            scale={displayed.scale}
            markerId={arrowId}
          />
        ) : null}
      </svg>

      {callout && box ? (
        <div
          className="sunburst__callout"
          role="status"
          style={{ left: box.x, top: box.y, width: box.width }}
        >
          {callout}
        </div>
      ) : null}

      {tooltip ? (
        <div className="sunburst__tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          {tooltip.text}
        </div>
      ) : null}

      <button type="button" className="sunburst__reset" onClick={() => onSelect(data.id)}>
        Reset
      </button>
    </div>
  )
}
