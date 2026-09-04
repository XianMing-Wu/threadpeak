import { useEffect, useRef } from 'react'
import './peak-hero.css'

export function PeakHero({ title, sub }: { title: string; sub: string }) {
  const heroRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const hero = heroRef.current
    if (!hero) return
    const io = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting && entry.intersectionRatio > 0.25) hero.classList.add('in-view')
      else hero.classList.remove('in-view')
    }, { threshold: [0, 0.25, 0.5, 0.75] })
    io.observe(hero)
    const frame = requestAnimationFrame(() => hero.classList.add('in-view'))
    return () => {
      cancelAnimationFrame(frame)
      io.disconnect()
    }
  }, [])

  return (
    <section className="peak-hero" ref={heroRef}>
      <div className="lamp-root">
        <div className="grid-fade"><div /></div>
        <div className="lamp-shaft" />
        <div className="lamp-stage">
          <div className="conic conic-l">
            <div className="mask-b" />
            <div className="mask-l" />
          </div>
          <div className="conic conic-r">
            <div className="mask-r" />
            <div className="mask-br" />
          </div>
          <div className="lamp-blur" />
          <div className="lamp-glass" />
          <div className="lamp-orb" />
        </div>
      </div>
      <div className="hero-copy">
        <h1 className="peak-hero-heading ux-flowith-heading">
          <span className="hero-title">{title}</span>
          <span className="hero-sub">{sub}</span>
          <div className="hero-rule" />
        </h1>
      </div>
    </section>
  )
}
