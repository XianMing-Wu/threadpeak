import { useId } from 'react'
import { brandOutlines } from './brand/outlines'

function Lettering({ name }: { name: keyof typeof brandOutlines }) {
  const glyphs = brandOutlines[name]
  const gradientId = useId()
  return <svg className={`brand-lettering brand-${name}`} viewBox={glyphs.viewBox} width={glyphs.width} height={glyphs.height} aria-hidden="true" focusable="false">
    {name === 'peak' && <defs><linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
      <stop className="brand-gradient-stop" offset="0%" stopColor="#1772f6" />
      <stop className="brand-gradient-stop" offset="45%" stopColor="#2ed7d0" />
      <stop className="brand-gradient-stop" offset="100%" stopColor="#8664ef" />
    </linearGradient></defs>}
    <path d={glyphs.path} fill="currentColor" />
    {name === 'peak' && <path className="brand-gradient-ink" d={glyphs.path} fill={`url(#${gradientId})`} />}
  </svg>
}

export function PeakWordmark() {
  return (
    <>
      <h1 className="home-h1">
        <span className="brand-accessible-text">问山，循着脉络，登上高峰</span>
        <span className="flow-text" aria-hidden="true"><Lettering name="peak" /></span>
        <span className="ideas" aria-hidden="true"><Lettering name="threads" /></span>
      </h1>
      <p className="home-sub"><span className="brand-accessible-text">循着脉络，登上高峰</span>
        <span className="home-sub-ink"><Lettering name="motto" /></span>
      </p>
    </>
  )
}
