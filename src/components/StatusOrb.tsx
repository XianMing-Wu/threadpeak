import { ThinkingOrb, type OrbSize, type OrbState } from 'thinking-orbs'
import './status-orb.css'

export type { OrbSize, OrbState }

const WAITING_ORB: OrbState = 'searching'

export function StatusOrb({
  state = WAITING_ORB,
  size = 64,
  paused,
  label,
  className,
}: {
  state?: OrbState
  size?: OrbSize
  paused?: boolean
  label?: string
  className?: string
}) {
  return (
    <span className={['tp-status-orb', className].filter(Boolean).join(' ')} data-size={size}>
      <ThinkingOrb
        state={state}
        size={size}
        theme="light"
        paused={paused}
        aria-label={label}
      />
    </span>
  )
}

export function StatusOrbChip({
  label,
  paused,
}: {
  label: string
  paused?: boolean
}) {
  return (
    <span className="tp-status-orb-chip" role="status">
      <StatusOrb state={WAITING_ORB} size={64} paused={paused} label={label} />
      <span className="tp-status-orb-chip__copy">
        <span className="tp-status-orb-chip__text">{label}</span>
        <span className="tp-status-orb-chip__dots" aria-hidden="true">
          <i /><i /><i />
        </span>
      </span>
    </span>
  )
}
