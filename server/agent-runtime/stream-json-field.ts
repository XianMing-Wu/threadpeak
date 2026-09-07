function isWs(ch: string) {
  return ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t'
}

const ESCAPED: Record<string, string> = {
  n: '\n',
  r: '\r',
  t: '\t',
  b: '\b',
  f: '\f',
  '"': '"',
  '\\': '\\',
  '/': '/',
}

export function streamingJsonField(raw: string, field: string): string {
  const source = raw.trim().replace(/^```(?:json)?\s*/i, '')
  const key = `"${field}"`
  const at = source.indexOf(key)
  if (at < 0) return ''
  let i = at + key.length
  while (i < source.length && isWs(source[i]!)) i += 1
  if (source[i] !== ':') return ''
  i += 1
  while (i < source.length && isWs(source[i]!)) i += 1
  if (source[i] !== '"') return ''
  i += 1
  let out = ''
  while (i < source.length) {
    const ch = source[i]!
    if (ch === '\\') {
      if (i + 1 >= source.length) break
      const next = source[i + 1]!
      if (next === 'u') {
        if (i + 5 >= source.length) break
        const hex = source.slice(i + 2, i + 6)
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) break
        out += String.fromCharCode(Number.parseInt(hex, 16))
        i += 6
        continue
      }
      out += ESCAPED[next] ?? next
      i += 2
      continue
    }
    if (ch === '"') break
    out += ch
    i += 1
  }
  return out
}
