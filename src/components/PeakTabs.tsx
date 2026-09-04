import type { ReactNode } from 'react'
import { Icon } from '../icons'
import './peak-tabs.css'

export type PeakTabIcon = 'users' | 'book' | 'search' | 'network'

export type PeakTabItem<T extends string = string> = {
  id: T
  label: string
  icon: PeakTabIcon
}

const ICONS: Record<PeakTabIcon, ReactNode> = {
  users: (
    <svg fill="currentColor" viewBox="0 0 256 256">
      <path d="M117.25,157.92a60,60,0,1,0-66.5,0A95.83,95.83,0,0,0,3.53,195.63a8,8,0,1,0,13.4,8.74,80,80,0,0,1,134.14,0,8,8,0,0,0,13.4-8.74A95.83,95.83,0,0,0,117.25,157.92ZM40,108a44,44,0,1,1,44,44A44.05,44.05,0,0,1,40,108Zm210.14,98.7a8,8,0,0,1-11.07-2.33A79.83,79.83,0,0,0,172,168a8,8,0,0,1,0-16,44,44,0,1,0-16.34-84.87,8,8,0,1,1-5.94-14.85,60,60,0,0,1,55.53,105.64,95.83,95.83,0,0,1,47.22,37.71A8,8,0,0,1,250.14,206.7Z" />
    </svg>
  ),
  book: (
    <svg fill="currentColor" viewBox="0 0 256 256">
      <path d="M232,48H160a40,40,0,0,0-32,16A40,40,0,0,0,96,48H24a8,8,0,0,0-8,8V200a8,8,0,0,0,8,8H96a24,24,0,0,1,24,24,8,8,0,0,0,16,0,24,24,0,0,1,24-24h72a8,8,0,0,0,8-8V56A8,8,0,0,0,232,48ZM96,192H32V64H96a24,24,0,0,1,24,24V200A39.81,39.81,0,0,0,96,192Zm128,0H160a39.81,39.81,0,0,0-24,8V88a24,24,0,0,1,24-24h64Z" />
    </svg>
  ),
  search: (
    <svg fill="currentColor" viewBox="0 0 256 256">
      <path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z" />
    </svg>
  ),
  network: <Icon name="network" size={16} />,
}

export function PeakTabs<T extends string>({
  items,
  active,
  onChange,
  className,
}: {
  items: readonly PeakTabItem<T>[]
  active: T
  onChange?: (id: T) => void
  className?: string
}) {
  return (
    <div className={className ? `peak-tabs ${className}` : 'peak-tabs'} role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={active === item.id}
          className={active === item.id ? 'tab active' : 'tab'}
          onClick={onChange ? () => onChange(item.id) : undefined}
        >
          <span className="tab-inner-wrap">
            <span className="inner">
              {ICONS[item.icon]}
              <span>{item.label}</span>
            </span>
          </span>
        </button>
      ))}
    </div>
  )
}
