import { useMemo, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import katex from 'katex'

type Segment = { type: 'text'; text: string } | { type: 'math'; text: string; display: boolean }

function splitFences(source: string): Array<{ code: boolean; text: string }> {
  const parts: Array<{ code: boolean; text: string }> = []
  const blocks = source.split(/(```[\s\S]*?```)/g)
  for (const block of blocks) {
    if (!block) continue
    parts.push({ code: block.startsWith('```'), text: block })
  }
  return parts.length ? parts : [{ code: false, text: source }]
}

function splitMath(source: string): Segment[] {
  const segments: Segment[] = []
  for (const block of splitFences(source)) {
    if (block.code) {
      segments.push({ type: 'text', text: block.text })
      continue
    }
    const re = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$([^$\n]+?)\$|\\\((.+?)\\\)/g
    let last = 0
    let match: RegExpExecArray | null
    while ((match = re.exec(block.text))) {
      if (match.index > last) segments.push({ type: 'text', text: block.text.slice(last, match.index) })
      segments.push({
        type: 'math',
        text: (match[1] ?? match[2] ?? match[3] ?? match[4] ?? '').trim(),
        display: match[1] != null || match[2] != null,
      })
      last = match.index + match[0].length
    }
    if (last < block.text.length) segments.push({ type: 'text', text: block.text.slice(last) })
  }
  return segments
}

function KatexView({ tex, display }: { tex: string; display: boolean }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex, { displayMode: display, throwOnError: false, trust: false, strict: 'ignore' })
    } catch {
      return ''
    }
  }, [display, tex])
  if (!html) return <code className="tp-math-fallback">{tex}</code>
  return <span className={display ? 'tp-math is-display' : 'tp-math is-inline'} dangerouslySetInnerHTML={{ __html: html }} />
}

export function MarkdownMath({ source, className }: { source: string; className?: string }) {
  const segments = useMemo(() => splitMath(source), [source])
  return (
    <div className={`md-body ${className ?? ''}`.trim()}>
      {segments.map((segment, index) => (
        segment.type === 'math'
          ? <KatexView key={`m${index}`} tex={segment.text} display={segment.display} />
          : <ReactMarkdown key={`t${index}`} remarkPlugins={[remarkGfm]}>{segment.text}</ReactMarkdown>
      ))}
    </div>
  )
}

export function maybeMarkdown(source: string): boolean {
  return /\$\$|\\\[|\\\(|^#{1,6}\s|^\s*[-*+]\s|^\s*\d+\.\s|`{1,3}|\*\*|__|\[.+\]\(/m.test(source)
}

export function renderOutputText(source: string, fallback?: ReactNode) {
  if (!source.trim()) return fallback ?? null
  return <MarkdownMath source={source} />
}
