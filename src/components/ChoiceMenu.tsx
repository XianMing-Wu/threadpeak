import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Icon } from '../icons'
import './choice-menu.css'

export type Choice<T extends string> = { value: T; label: string; description?: string }

/** One selection interaction for composer depth, topic filters and detail sheets.
 * A native popover supplies light-dismiss and the top layer, including inside dialogs.
 */
export function ChoiceMenu<T extends string>({ value, onChange, options, label, disabled = false, quiet = false, icon, hover = false, preferAbove = false }: {
  value: T; onChange: (value: T) => void; options: Choice<T>[]; label: string; disabled?: boolean; quiet?: boolean; icon?: ReactNode; hover?: boolean; preferAbove?: boolean
}) {
  const id = useId(), trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null)
  const hoverOpened = useRef(false)
  const hoverClose = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const cancelClose = () => clearTimeout(hoverClose.current)
  useEffect(() => () => cancelClose(), [])
  const [open, setOpen] = useState(false)
  const place = () => {
    const button = trigger.current, panel = menu.current
    if (!button || !panel) return
    const box = button.getBoundingClientRect(), gap = 6, margin = 12
    const width = Math.min(Math.max(box.width, 240), window.innerWidth - margin * 2)
    const below = window.innerHeight - box.bottom - margin - gap, above = box.top - margin - gap
    const upward = (preferAbove && above >= Math.min(panel.scrollHeight, 260)) || (below < Math.min(panel.scrollHeight, 260) && above > below)
    panel.style.width = `${width}px`
    panel.style.maxHeight = `${Math.max(80, Math.min(320, upward ? above : below))}px`
    panel.style.left = `${Math.max(margin, Math.min(box.left, window.innerWidth - width - margin))}px`
    panel.style.top = upward ? 'auto' : `${box.bottom + gap}px`
    panel.style.bottom = upward ? `${window.innerHeight - box.top + gap}px` : 'auto'
  }
  useEffect(() => {
    if (!open) return
    const closeOnScroll = (event: Event) => { if (!menu.current?.contains(event.target as Node)) menu.current?.hidePopover() }
    window.addEventListener('resize', place)
    window.addEventListener('scroll', closeOnScroll, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', closeOnScroll, true) }
  }, [open])
  const show = (focus = true) => { if(disabled||!options.length)return; hoverOpened.current = !focus; cancelClose(); place(); menu.current?.showPopover(); place(); if (focus) menu.current?.querySelector<HTMLButtonElement>('[aria-selected=true]')?.focus({preventScroll:true}) }
  return <span className={`tp-choice${quiet ? ' is-quiet' : ''}${hover ? ' is-thinking' : ''}`} onPointerEnter={()=>{if(hover){cancelClose();if(!menu.current?.matches(':popover-open'))show(false)}}} onPointerLeave={()=>{if(hover&&hoverOpened.current)hoverClose.current=setTimeout(()=>menu.current?.hidePopover(),160)}}>
    <button type="button" ref={trigger} className="tp-choice-trigger" role="combobox" aria-label={label} aria-haspopup="listbox" aria-controls={id} aria-expanded={open} disabled={disabled}
      onClick={() => open && !hoverOpened.current ? menu.current?.hidePopover() : show()}
      onKeyDown={event => { if (['ArrowDown','ArrowUp'].includes(event.key)) { event.preventDefault(); show() } }}>
      {icon}<span>{options.find(option => option.value === value)?.label ?? label}</span><Icon className="tp-choice-caret" name="prod-home-chevron-down" size={12}/>
    </button>
    <div id={id} ref={menu} popover="auto" className="tp-choice-menu" role="listbox" aria-label={label}
      onToggle={event => {setOpen(event.newState === 'open');if(event.newState==='closed')hoverOpened.current=false}}
      onKeyDown={event => {
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=option]')]
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
        let next = index
        if (event.key === 'ArrowDown') next = (index + 1) % buttons.length
        else if (event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length
        else if (event.key === 'Home') next = 0
        else if (event.key === 'End') next = buttons.length - 1
        else if (event.key === 'Tab') { menu.current?.hidePopover(); trigger.current?.focus(); return }
        else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); menu.current?.hidePopover(); trigger.current?.focus(); return }
        else return
        event.preventDefault(); buttons[next]?.focus()
      }}>
      {options.map(option => <button key={option.value} type="button" role="option" aria-selected={option.value === value} tabIndex={-1}
        onClick={() => { onChange(option.value); menu.current?.hidePopover(); trigger.current?.focus() }}>
        <span><b>{option.label}</b>{option.description && <small>{option.description}</small>}</span>{option.value === value && <Icon name="check" size={15}/>}
      </button>)}
    </div>
  </span>
}
