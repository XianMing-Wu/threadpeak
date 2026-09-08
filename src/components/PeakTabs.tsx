import { Icon } from '../icons'
import './peak-tabs.css'

export type PeakTabIcon = 'users' | 'book' | 'search' | 'network'
export type PeakTabItem<T extends string = string> = { id: T; label: string; icon: PeakTabIcon }

export function PeakTabs<T extends string>({ items, active, onChange, className }: {
  items: readonly PeakTabItem<T>[]
  active: T
  onChange?: (id: T) => void
  className?: string
}) {
  return <div className={className ? `peak-tabs ${className}` : 'peak-tabs'} role="group" aria-label="内容筛选">
    {items.map(item => <button
      key={item.id}
      type="button"
      aria-pressed={active === item.id}
      className={active === item.id ? 'tab active' : 'tab'}
      onClick={onChange ? () => onChange(item.id) : undefined}
    >
      <Icon name={item.icon === 'users' ? 'user' : item.icon} size={18} />
      <span>{item.label}</span>
    </button>)}
  </div>
}
