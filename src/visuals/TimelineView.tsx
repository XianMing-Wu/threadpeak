import { useEffect, useRef, useState } from 'react'
import { WineTimeline } from 'wine-timeline/timeline-engine.js'

type TimelineEngine = {
  setData: (data: unknown) => void
  updateTransform: (animated?: boolean) => void
  destroy: () => void
}

export function TimelineView({ data }: { data: unknown }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<TimelineEngine | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined
    const engine = new WineTimeline(host) as unknown as TimelineEngine
    engineRef.current = engine
    try {
      engine.setData(data)
      const frame = window.requestAnimationFrame(() => engine.updateTransform(false))
      setError('')
      return () => {
        window.cancelAnimationFrame(frame)
        engine.destroy()
        engineRef.current = null
      }
    } catch (item) {
      setError(item instanceof Error ? item.message : '时间线 JSON 无效')
      return () => {
        engine.destroy()
        engineRef.current = null
      }
    }
  }, [data])

  return (
    <div className="visual-chart visual-timeline">
      {error && <p className="visual-chart-error">{error}</p>}
      <div ref={hostRef} className="wine-timeline" />
    </div>
  )
}
