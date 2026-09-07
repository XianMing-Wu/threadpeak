import type { ReactNode } from 'react'

export function BeamFrame({ children, animated = true }: { children: ReactNode; animated?: boolean }) {
  return (
    <div className="ux-beam beam" data-active={animated ? 'true' : undefined}>
      {children}
      {animated && <div data-beam-bloom="true" />}
    </div>
  )
}
