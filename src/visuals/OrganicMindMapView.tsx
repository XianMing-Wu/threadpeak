import { useEffect, useRef, useState } from 'react'
import diagnosticsUrl from 'organic-mindmap/organic-json-diagnostics.js?url'
import mindmapUrl from 'organic-mindmap/organic-mindmap.js?url'

type Renderer = {
  setData: (data: unknown) => void
  destroy?: () => void
}

declare global {
  interface Window {
    OrganicMindMap?: new (container: Element, options?: { animate?: boolean }) => Renderer
  }
}

let loading: Promise<new (container: Element, options?: { animate?: boolean }) => Renderer> | null = null

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[data-organic-src="${src}"]`)
    if (existing) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = false
    script.dataset.organicSrc = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`无法加载 ${src}`))
    document.head.append(script)
  })
}

function loadOrganicMindMap() {
  if (window.OrganicMindMap) return Promise.resolve(window.OrganicMindMap)
  loading ??= loadScript(diagnosticsUrl).then(() => loadScript(mindmapUrl)).then(() => {
    if (!window.OrganicMindMap) throw new Error('OrganicMindMap 未注册')
    return window.OrganicMindMap
  })
  return loading
}

export function OrganicMindMapView({ data }: { data: unknown }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<Renderer | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined
    let dead = false
    loadOrganicMindMap().then((OrganicMindMap) => {
      if (dead || !hostRef.current) return
      engineRef.current?.destroy?.()
      const renderer = new OrganicMindMap(hostRef.current, { animate: true })
      renderer.setData(data)
      engineRef.current = renderer
      setError('')
    }).catch((item: Error) => {
      if (!dead) setError(item.message)
    })
    return () => {
      dead = true
      engineRef.current?.destroy?.()
      engineRef.current = null
    }
  }, [data])

  return (
    <div className="visual-chart visual-mindmap">
      {error && <p className="visual-chart-error">{error}</p>}
      <div ref={hostRef} className="organic-stage visual-mindmap-stage" tabIndex={0} />
    </div>
  )
}
