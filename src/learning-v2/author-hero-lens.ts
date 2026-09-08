import { createAuthorOrbit } from './author-hero-orbit'

type LensOptions = {
  root: HTMLElement; deck: HTMLElement; glass: HTMLElement; copy: HTMLElement
  motion: MediaQueryList
}

/** The orbit and optical copy share one clock, keeping the glass exactly in sync. */
export function mountAuthorLens({ root, deck, glass, copy, motion }: LensOptions) {
  const stage = deck.parentElement!
  const orbit = createAuthorOrbit(deck)
  let clone: HTMLElement, originals: HTMLElement[] = [], mirrors: HTMLElement[] = []
  let frame = 0, visible = true, disposed = false, elapsed = 0, lastTime = 0
  let reduced = motion.matches
  let width = stage.clientWidth, height = stage.clientHeight

  function rebuildMirror() {
    clone = deck.cloneNode(true) as HTMLElement
    clone.removeAttribute('id')
    clone.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'))
    clone.setAttribute('inert', '')
    copy.replaceChildren(clone)
    originals = [...deck.querySelectorAll<HTMLElement>('.au-orbit-card')]
    mirrors = [...clone.querySelectorAll<HTMLElement>('.au-orbit-card')]
    resize()
  }

  function resize() {
    width = stage.clientWidth; height = stage.clientHeight
    orbit.resize(width)
    copy.style.width = `${width}px`; copy.style.height = `${height}px`
    if (clone) { clone.style.width = `${width}px`; clone.style.height = `${height}px` }
    draw(performance.now())
  }

  function draw(time: number) {
    if (disposed || !clone) return
    if (lastTime && !reduced && visible && !document.hidden) elapsed += Math.min(50, time - lastTime)
    lastTime = time
    const radius = reduced ? 0 : 7
    const angle = elapsed / 6200 * Math.PI * 2
    const x = width / 2 + Math.cos(angle) * radius
    const y = height / 2 + Math.sin(angle) * radius
    const size = glass.offsetWidth, inset = 8, zoom = 1.55
    orbit.draw(elapsed)
    // These transforms are assigned by the same frame, not interpolated by CSS.
    const styles = originals.map(element => {
      const css = element.style
      return { transform: css.transform, opacity: css.opacity, zIndex: css.zIndex, className: element.className }
    })
    styles.forEach((style, index) => {
      const element = mirrors[index]
      if (!element) return
      element.className = style.className
      element.style.transform = style.transform
      element.style.opacity = style.opacity
      element.style.zIndex = style.zIndex
      element.style.transitionDuration = '0ms'
    })
    glass.style.transform = `translate3d(${x - size / 2}px, ${y - size / 2}px, 0)`
    copy.style.transform = `translate3d(${(size - inset * 2) / 2 - x * zoom}px, ${(size - inset * 2) / 2 - y * zoom}px, 0) scale(${zoom})`
    root.style.setProperty('--author-lens-x', `${x}px`)
    root.style.setProperty('--author-lens-y', `${y}px`)
  }

  function tick(time: number) {
    frame = 0; draw(time)
    if (!disposed && visible && !document.hidden && !reduced) frame = requestAnimationFrame(tick)
  }

  function activity() {
    cancelAnimationFrame(frame); frame = 0; lastTime = 0
    const animate = visible && !document.hidden && !reduced
    if (animate) {
      frame = requestAnimationFrame(tick)
    } else {
      draw(performance.now())
    }
    root.dataset.motion = animate ? 'running' : 'paused'
  }
  function onMotionChange(event: MediaQueryListEvent) { reduced = event.matches; activity() }

  rebuildMirror()
  const sizeObserver = new ResizeObserver(resize)
  sizeObserver.observe(stage)
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; activity() }, { threshold: 0 })
  observer.observe(root)
  motion.addEventListener('change', onMotionChange)
  document.addEventListener('visibilitychange', activity)
  activity()
  return () => {
    disposed = true; cancelAnimationFrame(frame)
    sizeObserver.disconnect(); observer.disconnect()
    motion.removeEventListener('change', onMotionChange)
    document.removeEventListener('visibilitychange', activity)
    copy.replaceChildren()
  }
}
