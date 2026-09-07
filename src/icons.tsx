import type { ReactNode, SVGProps } from 'react'
import spriteMarkup from './vendor/icons-v15.svg?raw'

const spritePrefix = 'threadpeak-icon-'
const inlineSpriteMarkup = spriteMarkup
  .replace(
    '<svg xmlns="http://www.w3.org/2000/svg">',
    '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" aria-hidden="true" focusable="false">',
  )
  .replaceAll(' id="', ` id="${spritePrefix}`)

const spriteNames = new Set([
  'collapse', 'search', 'book', 'history', 'chevron', 'send', 'arrow-right',
  'user', 'check', 'back', 'new-chat', 'message', 'panel',
  'prod-home-thinking-smart', 'prod-home-chevron-down',
  'prod-home-attachment', 'prod-home-send-disabled',
])

const custom: Record<string, ReactNode> = {
  route: <><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="19" r="2.5"/><path d="M15.5 5h-6a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7h-6"/></>,
  close: <path d="m7 7 10 10M17 7 7 17"/>,
  network: <><circle cx="6" cy="7" r="2.3"/><circle cx="18" cy="5" r="2.3"/><circle cx="17" cy="18" r="2.3"/><circle cx="7" cy="18" r="2.3"/><path d="m8.2 6.6 7.5-1.2M7.4 9l8.2 6.8M9.4 18h5.2M18 7.4v8.2"/></>,
  quote: <><path d="M9 11H5a4 4 0 0 1 4-4v9H5M19 11h-4a4 4 0 0 1 4-4v9h-4"/></>,
  zoomIn: <><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5M7 10h6M10 7v6"/></>,
  zoomOut: <><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5M7 10h6"/></>,
  target: <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></>,
  function: <><path d="M15 4c-3 0-4 2-4.5 5L9 18c-.3 1.5-1 2-2.5 2H5M7 11h8"/></>,
  layers: <><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/></>,
  brain: <><path d="M9 4a3 3 0 0 0-4 3 3.5 3.5 0 0 0-.5 6.8A3.5 3.5 0 0 0 9 19V4ZM15 4a3 3 0 0 1 4 3 3.5 3.5 0 0 1 .5 6.8A3.5 3.5 0 0 1 15 19V4Z"/><path d="M9 9H7M15 9h2M9 15H7M15 15h2"/></>,
  moon: <path d="M20.2 15.5A8.4 8.4 0 0 1 8.5 3.8 8.5 8.5 0 1 0 20.2 15.5Z"/>,
  logout: <><path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10"/></>,
  stop: <rect x="7" y="7" width="10" height="10" rx="1.6" fill="currentColor" stroke="none"/>,
}

/**
 * Keep the Zhida symbols in this document instead of referencing a Vite /@fs URL.
 * Some embedded browsers do not paint an external SVG <use> when its URL contains
 * an encoded file-system path and a fragment, which used to blank every product icon.
 */
export function IconSprite() {
  return <span className="tp-icon-sprite" aria-hidden="true" dangerouslySetInnerHTML={{ __html: inlineSpriteMarkup }} />
}

export function Icon({ name, size = 20, ...props }: SVGProps<SVGSVGElement> & { name: string; size?: number }) {
  if (spriteNames.has(name)) {
    return <svg width={size} height={size} fill="currentColor" aria-hidden="true" {...props}><use href={`#${spritePrefix}${name}`} /></svg>
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{custom[name] ?? custom.route}</svg>
}

export function MountainMark({ size = 28 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true"><rect width="28" height="28" rx="8" fill="#5a4df8"/><path d="M4.5 21 10.8 9.2l3.4 5 3.3-5.6L24 21H4.5Z" fill="#fff"/><path d="m8.8 13 2 2.9 1.8-2.5" fill="none" stroke="#5a4df8" strokeWidth="1.2"/></svg>
}
