import { useEffect, useRef } from 'react'

/** A rotating spherical helix, drawn locally; no video download or WebGL context. */
export function OrbitField({ dark }: { dark: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const element = canvas.current, context = element?.getContext('2d')
    if (!element || !context) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    let width = 0, height = 0, frame = 0, last = 0, angle = .8
    const draw = () => {
      context.clearRect(0, 0, width, height)
      const radius = Math.min(width * .46, height * .46)
      const paths = Array.from({ length: 12 }, () => new Path2D())
      for (let strand = 0; strand < 3; strand++) {
        let previous: { x: number; y: number } | null = null
        for (let i = 0; i <= 2200; i++) {
          const u = i / 2200, latitude = (u * 2 - 1) * .985
          const theta = u * Math.PI * 26 + angle, r = radius * Math.sqrt(1 - latitude * latitude) + strand * 1.5
          const x = Math.cos(theta) * r, z = Math.sin(theta) * r
          const y = latitude * radius * .97 + z * .18
          const point = { x: width / 2 + x * .987 + y * .16, y: height / 2 + y * .987 - x * .16 }
          // Small breaks move with the wire, making the slow rotation readable.
          const gap = Math.sin(u * 173 + strand * .11) > .988
          if (previous && !gap) {
            const depth = Math.max(0, Math.min(11, Math.floor((Math.sin(theta) + 1) * 5.999)))
            paths[depth].moveTo(previous.x, previous.y)
            paths[depth].lineTo(point.x, point.y)
          }
          previous = point
        }
      }
      paths.forEach((path, depth) => {
        const near = depth / 11
        context.strokeStyle = dark ? `rgba(188,185,230,${.06 + near * .53})` : `rgba(81,76,116,${.045 + near * .58})`
        context.lineWidth = .65
        context.stroke(path)
      })
    }
    const tick = (time: number) => {
      if (document.hidden || reduced.matches) { frame = 0; return }
      if (time - last >= 32) { angle += Math.min((time - last) / 1000, .06) * .22; last = time; draw() }
      frame = requestAnimationFrame(tick)
    }
    const resume = () => {
      cancelAnimationFrame(frame); frame = 0; last = performance.now()
      draw()
      if (!document.hidden && !reduced.matches) frame = requestAnimationFrame(tick)
    }
    const resize = () => {
      const rect = element.getBoundingClientRect(), ratio = Math.min(devicePixelRatio || 1, 2)
      width = rect.width; height = rect.height
      element.width = Math.round(width * ratio); element.height = Math.round(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      resume()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(element); reduced.addEventListener('change', resume); document.addEventListener('visibilitychange', resume)
    resize()
    return () => { cancelAnimationFrame(frame); observer.disconnect(); reduced.removeEventListener('change', resume); document.removeEventListener('visibilitychange', resume) }
  }, [dark])
  return <div className="auth-orbit" aria-hidden="true"><canvas ref={canvas}/></div>
}
