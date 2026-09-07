import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Icon } from '../icons'
import './floating-panel.css'

/** Editable, non-modal content in the browser top layer, anchored to its trigger. */
export function FloatingPanel({ label, triggerContent, title = label, children, width = 380, className = '' }: {
  label: string; title?: string; triggerContent?: ReactNode; width?: number; className?: string;
  children: (close: () => void) => ReactNode;
}) {
  const id = useId(), trigger = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const close = () => { panel.current?.hidePopover(); trigger.current?.focus({ preventScroll: true }) }
  const place = () => {
    const button = trigger.current, content = panel.current
    if (!button || !content) return
    const box = button.getBoundingClientRect(), margin = 12, gap = 8
    const panelWidth = Math.min(width, window.innerWidth - margin * 2)
    content.style.width = `${panelWidth}px`
    content.style.maxHeight = `${window.innerHeight - margin * 2}px`
    const below = window.innerHeight - box.bottom - margin - gap, above = box.top - margin - gap
    const height = Math.min(content.scrollHeight, window.innerHeight - margin * 2)
    content.style.left = `${Math.max(margin, Math.min(box.left, window.innerWidth - panelWidth - margin))}px`
    // Keep a short anchored panel above/below. A taller editor may overlap its
    // anchor rather than compress every field into an unnecessarily tiny scroller.
    const top = below >= height ? box.bottom + gap : above >= height ? box.top - gap - height
      : Math.max(margin, Math.min(box.top - height / 2, window.innerHeight - height - margin))
    content.style.top = `${top}px`
    content.style.bottom = 'auto'
  }
  useEffect(() => {
    if (!open) return
    const onScroll = (event: Event) => { if (!panel.current?.contains(event.target as Node)) panel.current?.hidePopover() }
    window.addEventListener('resize', place)
    window.addEventListener('scroll', onScroll, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', onScroll, true) }
  }, [open, width])
  return <span className={`tp-floating ${className}`}>
    <button type="button" ref={trigger} className="tp-floating-trigger" aria-label={label} aria-haspopup="dialog" aria-expanded={open} aria-controls={id}
      onClick={() => {
        if (panel.current?.matches(':popover-open')) { close(); return }
        place(); panel.current?.showPopover(); place()
        panel.current?.querySelector<HTMLElement>('[data-initial-focus]')?.focus({ preventScroll: true })
      }}>{triggerContent ?? label}</button>
    <div ref={panel} id={id} popover="auto" role="dialog" aria-labelledby={`${id}-title`} className="tp-floating-panel"
      onToggle={event => setOpen(event.newState === 'open')}
      onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() } }}>
      <header><h3 id={`${id}-title`}>{title}</h3><button type="button" aria-label={`关闭${title}`} onClick={close}><Icon name="close" size={16}/></button></header>
      {children(close)}
    </div>
  </span>
}
