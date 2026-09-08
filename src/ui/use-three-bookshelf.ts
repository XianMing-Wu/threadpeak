import { useEffect, useState, type RefObject } from 'react'
import { loadShelfReflections } from './shelf-reflections'

/** One lazy WebGL context for the entire cabinet; native DOM remains the accessible input layer. */
export function useThreeBookshelf(cabinet: RefObject<HTMLDivElement | null>, canvas: RefObject<HTMLCanvasElement | null>) {
  const [status, setStatus] = useState<'loading' | 'three' | 'unavailable'>('loading')
  useEffect(() => {
    const element = cabinet.current, surface = canvas.current
    if (!element || !surface) return
    // SSR / non-graphics environments retain the complete, working DOM version.
    if (typeof WebGL2RenderingContext === 'undefined') {
      queueMicrotask(() => setStatus('unavailable'))
      return
    }
    let cancelled = false, dispose: (() => void) | undefined
    Promise.all([import('./shelf-scene'), loadShelfReflections()]).then(([{ mountShelfScene }, reflections]) => {
      if (cancelled) return
      dispose = mountShelfScene(element, surface, reflections, value => { if (!cancelled) setStatus(value) })
    }).catch(() => { if (!cancelled) setStatus('unavailable') })
    return () => { cancelled = true; dispose?.() }
  }, [cabinet, canvas])
  return status
}
