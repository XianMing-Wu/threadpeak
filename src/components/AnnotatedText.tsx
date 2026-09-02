import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { MarkdownMath } from '../lib/MarkdownMath'
import { annotationsForText, findQuoteSpan, type AskAuthorsAnnotation } from '../session/ask-authors'

type Hit = { start: number; end: number; items: AskAuthorsAnnotation[] }
type Box = { left: number; top: number; width: number; height: number }
type BallAnchor = { id: string; ordinal: number; left: number; top: number }

function hitsFor(text: string, annotations: readonly AskAuthorsAnnotation[]): Hit[] {
  const found: { start: number; end: number; item: AskAuthorsAnnotation }[] = []
  for (const item of annotationsForText(text, annotations)) {
    const span = findQuoteSpan(text, item.quote)
    if (!span) continue
    found.push({ start: span.start, end: span.end, item })
  }
  found.sort((left, right) => left.start - right.start || left.item.ordinal - right.item.ordinal)
  const merged: Hit[] = []
  for (const next of found) {
    const last = merged[merged.length - 1]
    if (last && next.start < last.end) {
      last.items.push(next.item)
      last.end = Math.max(last.end, next.end)
      continue
    }
    merged.push({ start: next.start, end: next.end, items: [next.item] })
  }
  return merged
}

export function AnnotatedText({
  text,
  annotations,
  activeId,
  onOpen,
}: {
  text: string
  annotations: readonly AskAuthorsAnnotation[]
  activeId?: string | null
  onOpen: (id: string) => void
}) {
  const hits = hitsFor(text, annotations)
  if (hits.length === 0) return <>{text}</>

  const parts: ReactNode[] = []
  let cursor = 0
  hits.forEach((hit, index) => {
    if (hit.start > cursor) parts.push(text.slice(cursor, hit.start))
    parts.push(
      <mark key={`${hit.start}-${index}`} className="annotation-quote">
        {text.slice(hit.start, hit.end)}
        <AnnotationBalls items={hit.items} activeId={activeId} onOpen={onOpen}/>
      </mark>,
    )
    cursor = hit.end
  })
  if (cursor < text.length) parts.push(text.slice(cursor))
  return <>{parts}</>
}

function AnnotationBalls({
  items,
  activeId,
  onOpen,
}: {
  items: readonly AskAuthorsAnnotation[]
  activeId?: string | null
  onOpen: (id: string) => void
}) {
  return items.map((item) => (
    <button
      key={item.id}
      type="button"
      className={`annotation-ball${activeId === item.id ? ' is-active' : ''}`}
      aria-label={`打开第 ${item.ordinal} 条批注`}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation()
        onOpen(item.id)
      }}
    >
      {item.ordinal}
    </button>
  ))
}

function readVisibleText(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const el = node.parentElement
      if (!el || el.closest('.katex-mathml, .annotation-layer, .annotation-ball')) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })
  const nodes: { node: Text; start: number }[] = []
  let text = ''
  let current = walker.nextNode()
  while (current) {
    const node = current as Text
    nodes.push({ node, start: text.length })
    text += node.data
    current = walker.nextNode()
  }
  return { text, nodes }
}

function locateOffset(
  nodes: readonly { node: Text; start: number }[],
  offset: number,
  edge: 'start' | 'end',
) {
  for (let index = 0; index < nodes.length; index += 1) {
    const item = nodes[index]
    if (!item) continue
    const next = item.start + item.node.data.length
    if (edge === 'end' && offset === next) return { node: item.node, offset: item.node.data.length }
    if (offset >= item.start && offset < next) return { node: item.node, offset: offset - item.start }
  }
  const last = nodes[nodes.length - 1]
  if (edge === 'end' && last) return { node: last.node, offset: last.node.data.length }
  return null
}

function rangeFromSpan(
  nodes: readonly { node: Text; start: number }[],
  start: number,
  end: number,
) {
  const startAt = locateOffset(nodes, start, 'start')
  const endAt = locateOffset(nodes, end, 'end')
  if (!startAt || !endAt) return null
  const range = document.createRange()
  range.setStart(startAt.node, startAt.offset)
  range.setEnd(endAt.node, endAt.offset)
  return range
}

function toLocal(host: HTMLElement, rect: DOMRect): Box {
  const hostBox = host.getBoundingClientRect()
  const scaleX = hostBox.width / (host.offsetWidth || hostBox.width) || 1
  const scaleY = hostBox.height / (host.offsetHeight || hostBox.height) || 1
  return {
    left: (rect.left - hostBox.left) / scaleX,
    top: (rect.top - hostBox.top) / scaleY,
    width: rect.width / scaleX,
    height: rect.height / scaleY,
  }
}

function measureAnnotationLayer(
  host: HTMLElement,
  body: HTMLElement,
  annotations: readonly AskAuthorsAnnotation[],
) {
  const visible = readVisibleText(body)
  const boxes: Box[] = []
  const balls: BallAnchor[] = []
  for (const item of annotations) {
    if (!item.quote) continue
    const span = findQuoteSpan(visible.text, item.quote)
    if (!span) continue
    const range = rangeFromSpan(visible.nodes, span.start, span.end)
    if (!range) continue
    const rects = [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0)
    for (const rect of rects) boxes.push(toLocal(host, rect))
    const last = rects[rects.length - 1]
    if (!last) continue
    const local = toLocal(host, last)
    balls.push({
      id: item.id,
      ordinal: item.ordinal,
      left: local.left + local.width + 4,
      top: local.top + local.height / 2 - 9,
    })
  }
  return { boxes, balls }
}

export function AnnotatedMarkdown({
  source,
  annotations,
  activeId,
  onOpen,
  className,
}: {
  source: string
  annotations: readonly AskAuthorsAnnotation[]
  activeId?: string | null
  onOpen: (id: string) => void
  className?: string
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const onOpenRef = useRef(onOpen)
  const annotationsRef = useRef(annotations)
  onOpenRef.current = onOpen
  annotationsRef.current = annotations
  const [layer, setLayer] = useState<{ boxes: Box[]; balls: BallAnchor[] }>({ boxes: [], balls: [] })
  const signature = annotations.map((item) => `${item.id}:${item.ordinal}:${item.quote}`).join('|')

  useLayoutEffect(() => {
    const host = hostRef.current
    const body = host?.querySelector('.md-body')
    if (!host || !(body instanceof HTMLElement)) {
      setLayer({ boxes: [], balls: [] })
      return
    }
    const measure = () => setLayer(measureAnnotationLayer(host, body, annotationsRef.current))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(body)
    return () => observer.disconnect()
  }, [signature, source])

  return (
    <div ref={hostRef} className={`annotated-markdown ${className ?? ''}`.trim()}>
      <MarkdownMath source={source}/>
      {layer.boxes.length + layer.balls.length > 0 && (
        <div className="annotation-layer">
          {layer.boxes.map((box, index) => (
            <i
              key={`q${index}`}
              className="annotation-quote-box"
              style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
            />
          ))}
          {layer.balls.map((ball) => (
            <button
              key={ball.id}
              type="button"
              className={`annotation-ball${activeId === ball.id ? ' is-active' : ''}`}
              style={{ left: ball.left, top: ball.top }}
              aria-label={`打开第 ${ball.ordinal} 条批注`}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                onOpenRef.current(ball.id)
              }}
            >
              {ball.ordinal}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
