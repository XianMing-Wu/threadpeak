import { brandOutlines } from './brand/outlines'

function Lettering({ name }: { name: keyof typeof brandOutlines }) {
  const glyphs = brandOutlines[name]
  return <svg className={`brand-lettering brand-${name}`} viewBox={glyphs.viewBox} width={glyphs.width} height={glyphs.height} aria-hidden="true" focusable="false"><path d={glyphs.path} fill="currentColor" /></svg>
}

export function PeakWordmark() {
  return (
    <>
      <h1 className="home-h1" aria-label="Peak with threads">
        <span className="flow-text"><Lettering name="peak" /></span>
        <span className="ideas"><Lettering name="threads" /></span>
      </h1>
      <p className="home-sub"><span className="brand-accessible-text">循着脉络，登上高峰</span>
        <span className="home-sub-ink"><Lettering name="motto" /></span>
      </p>
    </>
  )
}
