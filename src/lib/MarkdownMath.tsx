import { Children, isValidElement, useMemo, type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import katex from 'katex'
import { prepareMarkdown } from './markdown-source.ts'

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

function texOf(children: ReactNode) {
  return Children.toArray(children).map((child) => typeof child === 'string' || typeof child === 'number' ? String(child) : '').join('').replace(/\n$/, '')
}

function mathComponents(): Components {
  return {
    code({ className, children, ...props }: { className?: string; children?: ReactNode }) {
      const tex = texOf(children)
      if (className?.includes('math-display')) return <KatexView tex={tex} display />
      if (className?.includes('math-inline')) return <KatexView tex={tex} display={false} />
      return <code className={className} {...props}>{children}</code>
    },
    pre({ children }: { children?: ReactNode }) {
      const child = Children.toArray(children)[0]
      if (isValidElement<{ className?: string }>(child) && child.props.className?.includes('math')) {
        return <>{children}</>
      }
      return <pre>{children}</pre>
    },
  }
}

export function MarkdownMath({ source, className }: { source: string; className?: string }) {
  const prepared = useMemo(() => prepareMarkdown(source), [source])
  const components = useMemo(() => mathComponents(), [])
  return (
    <div className={`md-body ${className ?? ''}`.trim()}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} components={components}>
        {prepared.markdown}
      </ReactMarkdown>
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
