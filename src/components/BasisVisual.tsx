import { useId } from 'react'

export function BasisVisual({ caption = '基向量经过线性变换后的去向' }: { caption?: string }) {
  const gridId = `basis-grid-${useId().replace(/:/g, '')}`
  return <div className="mini-visual">
    <svg viewBox="0 0 360 128" aria-hidden="true">
      <defs>
        <pattern id={gridId} width="18" height="18" patternUnits="userSpaceOnUse">
          <path d="M18 0H0V18" fill="none" stroke="#dfe7f6"/>
        </pattern>
      </defs>
      <rect width="360" height="128" fill={`url(#${gridId})`}/>
      <path d="M70 108V20M26 82h126" stroke="#8995a7"/>
      <path d="m70 82 58-34M128 48l-9 1m9-1-4 9" stroke="#1772f6" strokeWidth="3"/>
      <path d="M230 108V20M186 82h144" stroke="#8995a7"/>
      <path d="m230 82 66-18M296 64l-9-3m9 3-7 7" stroke="#00a36c" strokeWidth="3"/>
    </svg>
    <span>{caption}</span>
  </div>
}
