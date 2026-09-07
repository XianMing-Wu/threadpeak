export type SourceLink = { kind: 'external'; href: string } | { kind: 'demo' | 'unavailable'; href?: never }

/** Mock OAuth sources are preview-only, including when restored from old search history. */
export function sourceLink(url: string | null | undefined): SourceLink {
  if (!url) return { kind: 'unavailable' }
  try {
    const parsed = new URL(url)
    if (parsed.hostname === 'zhihu-demo.invalid') return { kind: 'demo' }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return { kind: 'unavailable' }
    return { kind: 'external', href: parsed.href }
  } catch { return { kind: 'unavailable' } }
}

export function isDemoSourceUrl(url: string | null | undefined): boolean {
  return sourceLink(url).kind === 'demo'
}
