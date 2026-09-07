import { Children, isValidElement, memo, useMemo, useState, type ReactNode } from 'react'
import { streamingMarkdown } from '../../packages/contracts/src/streaming-markdown.ts'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { renderMath } from '../../packages/contracts/src/math-normalize.ts'
import { prepareReading } from '../../packages/contracts/src/reading-policy.ts'
import { sourceImageInfo } from '../../packages/contracts/src/source-image.ts'
import './source-images.css'

export function SourceImageView({ src, alt, title }: { src?: string; alt?: string; title?: string }) {
  const info = useMemo(() => sourceImageInfo({ src, alt, title }), [src, alt, title])
  const [failedSrc, setFailedSrc] = useState<string>()
  const fallback = info.tex || info.alt || (info.formula ? '公式图片' : '资料图片')
  if (!info.src || failedSrc === info.src) return <span className="tp-source-image-fallback" role="img" aria-label={`${fallback}：图片未能加载`}>
    {fallback}<span className="tp-source-image-status">（图片未能加载）</span>
  </span>
  return <img className={info.formula ? 'tp-source-image is-formula' : 'tp-source-image'} src={info.src} alt={fallback}
    title={title} referrerPolicy="no-referrer" loading="lazy" decoding="async" onError={() => setFailedSrc(info.src)} />
}

function KatexView({ tex, display }: { tex: string; display: boolean }) {
  const result=useMemo(()=>renderMath(tex,display),[tex,display])
  if(result.kind==='unresolved')return <span className="tp-math-unresolved" title="这段原式缺少可确定的数学信息，已保留原文，可在文档中修正。">{tex}</span>
  return <span className={display ? 'tp-math is-display' : 'tp-math is-inline'} data-math-repaired={result.repaired||undefined} dangerouslySetInnerHTML={{ __html: result.html }} />
}

function texOf(children: ReactNode) {
  return Children.toArray(children).map((child) => typeof child === 'string' || typeof child === 'number' ? String(child) : '').join('').replace(/\n$/, '')
}

function mathComponents(): Components {
  return {
    code({ className, children }: { className?: string; children?: ReactNode }) {
      const tex = texOf(children)
      if (className?.includes('math-display')) return <KatexView tex={tex} display />
      if (className?.includes('math-inline')) return <KatexView tex={tex} display={false} />
      return <code className={className}>{children}</code>
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

export const MarkdownMath=memo(function MarkdownMath({ source, className, passive=false, sourceExcerpt=false, streaming=false }: { source: string; className?: string; passive?:boolean; sourceExcerpt?:boolean; streaming?:boolean }) {
  const prepared = useMemo(() => prepareReading(streaming?streamingMarkdown(source):source, sourceExcerpt), [source, sourceExcerpt, streaming])

  const components = useMemo(() => ({...mathComponents(),...(passive?{a:({children}:{children?:ReactNode})=><span>{children}</span>}:{}),
    img: ({src,alt,title}:{src?:string;alt?:string;title?:string;children?:ReactNode}) => <SourceImageView key={`${src}:${alt}`} src={src} alt={alt} title={title} />,
  }), [passive])
  return (
    <div className={`md-body ${className ?? ''}`.trim()} data-reading-version={prepared.version} data-reading-issues={prepared.diagnostics.map(d=>d.code).join(' ')||undefined}>
      {prepared.incompleteSource && <p className="tp-source-excerpt-note" role="note">搜索摘要缺少部分公式，下方保留原始内容。请阅读原文核对完整表达式。</p>}
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} components={components} {...{skipHtml:true}}>
        {prepared.markdown}
      </ReactMarkdown>

    </div>
  )
})

export function maybeMarkdown(source: string): boolean {
  return /\$\$|\\\[|\\\(|^#{1,6}\s|^\s*[-*+]\s|^\s*\d+\.\s|`{1,3}|\*\*|__|\[.+\]\(/m.test(source)
}

export function renderOutputText(source: string, fallback?: ReactNode) {
  if (!source.trim()) return fallback ?? null
  return <MarkdownMath source={source} />
}
