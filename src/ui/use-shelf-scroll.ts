import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react'

/** Whole-book stops with bounded native touch scrolling and one-book mouse/keyboard gestures. */
export function useShelfScroll(count: number) {
  const viewport = useRef<HTMLDivElement>(null)
  const frame = useRef(0)
  const dragged = useRef(false)
  const destination = useRef<number | null>(null)
  const pointer = useRef<{ id: number; start: number; origin: number; displacement: number } | null>(null)
  const boundary = useRef({ left: false, right: false })
  const [edges, setEdges] = useState(boundary.current)
  const updateBounds = useCallback(() => {
    const element = viewport.current
    if (!element) return
    const next = { left: element.scrollLeft > 1, right: element.scrollLeft < element.scrollWidth - element.clientWidth - 1 }
    if (next.left !== boundary.current.left || next.right !== boundary.current.right) {
      boundary.current = next
      setEdges(next)
    }
  }, [])
  const stride = useCallback(() => {
    const books = viewport.current?.querySelectorAll<HTMLElement>('.knowledge-book-slot')
    return books && books.length > 1 ? books[1].offsetLeft - books[0].offsetLeft : 0
  }, [])
  const align = useCallback((position: number) => {
    const element = viewport.current
    if (!element) return
    cancelAnimationFrame(frame.current)
    const target = Math.max(0, Math.min(element.scrollWidth - element.clientWidth, position))
    const distance = target - element.scrollLeft
    destination.current = target
    element.classList.add('is-aligning')
    const finish = () => {
      element.scrollLeft = target
      element.classList.remove('is-aligning')
      frame.current = 0; destination.current = null
      updateBounds()
    }
    if (Math.abs(distance) < 1 || matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return }
    const start = performance.now(), origin = element.scrollLeft
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / 300), eased = 1 - (1 - progress) ** 3
      element.scrollLeft = origin + distance * eased
      updateBounds()
      if (progress < 1) frame.current = requestAnimationFrame(step)
      else finish()
    }
    frame.current = requestAnimationFrame(step)
  }, [updateBounds])
  const move = useCallback((direction: number) => {
    const element = viewport.current, step = stride()
    if (!element || !step) return
    align((Math.round((destination.current ?? element.scrollLeft) / step) + direction) * step)
  }, [align, stride])
  useEffect(() => {
    const element = viewport.current, track = element?.querySelector<HTMLElement>('.knowledge-shelf-track')
    if (!element || !track) return
    const observer = new ResizeObserver(() => {
      const step = stride()
      if (step && !pointer.current) align(Math.round(element.scrollLeft / step) * step)
      updateBounds()
    })
    observer.observe(element); observer.observe(track)
    let lastWheel = 0
    const wheel = (event: WheelEvent) => {
      if (event.shiftKey && !event.deltaX) {
        event.preventDefault()
        if (performance.now() - lastWheel > 220) move(Math.sign(event.deltaY))
        lastWheel = performance.now()
      }
    }
    element.addEventListener('wheel', wheel, { passive: false })
    return () => { observer.disconnect(); element.removeEventListener('wheel', wheel); cancelAnimationFrame(frame.current); element.classList.remove('is-aligning', 'is-dragging') }
  }, [count, updateBounds, stride, align, move])
  function stopPointer(event: ReactPointerEvent) {
    const element = viewport.current, current = pointer.current
    if (!element || !current || event.pointerId !== current.id) return
    if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId)
    pointer.current = null
    // Keep snapping suspended until the final target is installed, so release cannot jump first.
    if (dragged.current) align(current.origin + (event.type === 'pointercancel' ? 0 : Math.sign(current.displacement)) * stride())
    element.classList.remove('is-dragging')
  }
  return { viewport, move, edges, handlers: {
    onScroll: updateBounds,
    onPointerDown: (event: ReactPointerEvent) => {
      dragged.current = false
      if (event.pointerType === 'touch' || event.button !== 0 || count < 2) return
      cancelAnimationFrame(frame.current)
      destination.current = null
      const element = viewport.current, step = stride()
      if (!element || !step) return
      element.classList.remove('is-aligning')
      pointer.current = { id: event.pointerId, start: event.clientX, origin: Math.round(element.scrollLeft / step) * step, displacement: 0 }
    },
    onPointerMove: (event: ReactPointerEvent) => {
      const current = pointer.current, element = viewport.current
      if (!current || !element) return
      if (!dragged.current && Math.abs(event.clientX - current.start) < 6) return
      dragged.current = true
      element.classList.add('is-dragging')
      element.setPointerCapture(current.id)
      event.preventDefault()
      current.displacement = current.start - event.clientX
      const step = stride()
      element.scrollLeft = current.origin + Math.max(-step, Math.min(step, current.displacement))
      updateBounds()
    },
    onPointerUp: stopPointer,
    onPointerCancel: stopPointer,
    onClickCapture: (event: ReactMouseEvent) => { if (dragged.current && event.detail > 0) { event.preventDefault(); event.stopPropagation() } },
  } }
}
