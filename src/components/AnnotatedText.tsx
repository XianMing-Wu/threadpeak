import type { ReactNode } from 'react'
import { annotationsForText, type AskAuthorsAnnotation } from '../session/ask-authors'

type Hit = { start: number; end: number; items: AskAuthorsAnnotation[] }

function hitsFor(text: string, annotations: readonly AskAuthorsAnnotation[]): Hit[] {
  const found: { start: number; end: number; item: AskAuthorsAnnotation }[] = []
  for (const item of annotationsForText(text, annotations)) {
    const start = text.indexOf(item.quote)
    if (start < 0) continue
    found.push({ start, end: start + item.quote.length, item })
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
        {hit.items.map((item) => (
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
        ))}
      </mark>,
    )
    cursor = hit.end
  })
  if (cursor < text.length) parts.push(text.slice(cursor))
  return <>{parts}</>
}
