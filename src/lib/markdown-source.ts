export type PreparedMath = { tex: string; display: boolean }

export type PreparedMarkdown = {
  markdown: string
  math: PreparedMath[]
}

const SLOT = (index: number) => `%%TPMATH${index}%%`

export function mathPlaceholder(index: number) {
  return SLOT(index)
}

export function parseMathPlaceholder(value: string) {
  const match = /^%%TPMATH(\d+)%%$/.exec(value)
  return match ? Number(match[1]) : undefined
}

export function isShortInlineMath(tex: string) {
  const compact = tex.replace(/\s+/g, '')
  if (!compact) return false
  if (/\\begin|\\tag|\\\\/.test(tex)) return false
  return !tex.includes('\n') && compact.length <= 48
}

function splitFences(source: string): Array<{ code: boolean; text: string }> {
  const parts: Array<{ code: boolean; text: string }> = []
  const blocks = source.split(/(```[\s\S]*?```)/g)
  for (const block of blocks) {
    if (!block) continue
    parts.push({ code: block.startsWith('```'), text: block })
  }
  return parts.length ? parts : [{ code: false, text: source }]
}

function loosenChineseBlocks(text: string) {
  return text
    .replace(/([。！？])(\d+[\s.、])/g, '$1\n\n$2')
    .replace(/([。！？”」』；，：)）])\s*[·•・‧]\s*/g, '$1\n- ')
    .replace(/(^|\n)[·•・‧]\s*/g, '$1- ')
}

function wrapAsInline(chunk: string) {
  const tex = chunk.trim()
  if (!tex || tex.includes('%%TPMATH')) return chunk
  if (/^\\(?:left|right)$/.test(tex)) return chunk
  return `$${tex}$`
}

function dollars(tex: string, display: boolean) {
  return display ? `$$\n${tex}\n$$` : `$${tex}$`
}

function protectDelimited(text: string, slots: string[]) {
  return text.replace(/\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$([^$\n]+?)\$|\\\((.+?)\\\)/g, (_all, displayA, displayB, inlineA, inlineB) => {
    const raw = String(displayA ?? displayB ?? inlineA ?? inlineB ?? '')
    const tex = raw.trim()
    if (!tex) return ''
    const display = (displayA != null || displayB != null) && (raw.includes('\n') || !isShortInlineMath(tex))
    const index = slots.length
    slots.push(dollars(tex, display))
    return SLOT(index)
  })
}

function restoreSlots(text: string, slots: readonly string[]) {
  let current = text
  for (let step = 0; step < 16; step += 1) {
    if (!current.includes('%%TPMATH')) break
    current = current.replace(/%%TPMATH(\d+)%%/g, (_all, index) => slots[Number(index)] ?? '')
  }
  return current
}

function isInlineDollar(value: string) {
  return /^\$(?!\$)[^$\n]+\$$/.test(value)
}

function mergeAdjacentSlots(text: string, slots: string[]) {
  return text.replace(/(?:%%TPMATH\d+%%)+/g, (run) => {
    const indexes = [...run.matchAll(/%%TPMATH(\d+)%%/g)].map((match) => Number(match[1]))
    if (indexes.length < 2) return run
    const values = indexes.map((index) => slots[index] ?? '')
    if (!values.every((value) => isInlineDollar(value))) return run
    const index = slots.length
    slots.push(`$${values.map((value) => value.slice(1, -1)).join('')}$`)
    return SLOT(index)
  })
}

function mergeAdjacentInlineDollars(text: string) {
  let current = text
  for (let step = 0; step < 32; step += 1) {
    const next = current.replace(/\$([^$\n]+?)\$\$([^$\n]+?)\$/g, (_all, left, right) => `$${left}${right}$`)
    if (next === current) break
    current = next
  }
  return current.replace(/\$([^$\n]+?)\$(?=\$)/g, '$$$1$ ')
}

function wrapProbability(text: string) {
  return text.replace(
    /P\s*(?:\\left\s*)?\((?:[^()%]|\([^()%]*\)){1,220}\)(?:\s*\\right)?/g,
    wrapAsInline,
  )
}

function wrapLeftRight(text: string) {
  return text
    .replace(/(?:\\[a-zA-Z]+)*\\left[^%\n=]{0,180}?\\right\s*[).\]|]/g, wrapAsInline)
    .replace(/\\xrightarrow\{[^{}%]*\}/g, wrapAsInline)
}

function wrapBracedTex(text: string) {
  return text.replace(
    /\{(?=[^{}]*[_^])(?:[^{}]|\{[^{}]*\})+\}(?:\\in\s*\[[^\]\n]+\])?/g,
    (chunk) => wrapAsInline(chunk.replace(/^\{([\s\S]*)\}/, '$1')),
  )
}

function wrapTexScripts(text: string) {
  return text.replace(
    /(?<![A-Za-z\\%])[A-Za-z][A-Za-z0-9]*(?:_\{[^{}]+\}|\^\{[^{}]+\})+[A-Za-z0-9]*(?:\\in\s*(?:\[[^\]\n]+\]|\\left[\s\S]{0,80}?\\right\s*[).\]|]))?/g,
    wrapAsInline,
  )
}

function wrapPrimeBraces(text: string) {
  return text.replace(/(?<![A-Za-z\\%$])([A-Za-z])\{'\}/g, (_all, name) => `$${name}'$`)
}

function wrapSimpleSubs(text: string) {
  return text.replace(/(?<![A-Za-z\\%$])[A-Za-z]_[A-Za-z0-9]+(?![A-Za-z0-9])/g, wrapAsInline)
}

function normalizeXrightarrow(text: string) {
  return text.replace(
    /\\xrightarrow(?:\s*)(?!\{)([A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)?)/g,
    '\\xrightarrow{$1}',
  )
}

function wrapTransitionChains(text: string) {
  return text.replace(
    /[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)?(?:\s*\\xrightarrow\{[^{}]*\}(?:\s*[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)?|\.{2,})?)+/g,
    wrapAsInline,
  )
}

function wrapCommandRuns(text: string) {
  return text.replace(
    /(?:[A-Za-z][A-Za-z0-9]*)?(?=\\(?:times|rightarrow|in|mathbb|cdot|ldots|to|subset|subseteq))(?:\\[a-zA-Z]+(?:\s*\{[^{}]*\})?|\\[^a-zA-Z\s$%])+(?:\s*(?:\\[a-zA-Z]+(?:\s*\{[^{}]*\})?|\\[^a-zA-Z\s$%]|\{[^{}]+\}|\[[^\]\n]+\]|[A-Za-z][A-Za-z0-9]*))*|(?:\\[a-zA-Z]+(?:\s*\{[^{}]*\})?|\\[^a-zA-Z\s$%])+(?:\s*(?:\\[a-zA-Z]+(?:\s*\{[^{}]*\})?|\\[^a-zA-Z\s$%]|\{[^{}]+\}|\[[^\]\n]+\]|[A-Za-z][A-Za-z0-9]*))*/g,
    wrapAsInline,
  )
}

function wrapBareMath(text: string, slots: string[]) {
  const step = (value: string, wrap: (input: string) => string) => protectDelimited(wrap(value), slots)
  let next = normalizeXrightarrow(text)
  next = step(next, wrapTransitionChains)
  next = step(next, wrapProbability)
  next = step(next, wrapLeftRight)
  next = step(next, wrapBracedTex)
  next = step(next, wrapTexScripts)
  next = step(next, wrapPrimeBraces)
  next = step(next, wrapSimpleSubs)
  next = step(next, wrapCommandRuns)
  return mergeAdjacentSlots(next, slots)
}

function collectDelimitedMath(markdown: string): PreparedMath[] {
  const math: PreparedMath[] = []
  for (const block of splitFences(markdown)) {
    if (block.code) continue
    const pattern = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g
    let match: RegExpExecArray | null
    while ((match = pattern.exec(block.text))) {
      const raw = String(match[1] ?? match[2] ?? '')
      const tex = raw.trim()
      if (!tex) continue
      math.push({
        tex,
        display: match[1] != null && (raw.includes('\n') || !isShortInlineMath(tex)),
      })
    }
  }
  return math
}

function prepareText(text: string) {
  const slots: string[] = []
  const protectedText = protectDelimited(text, slots)
  return mergeAdjacentInlineDollars(restoreSlots(wrapBareMath(protectedText, slots), slots))
}

export function prepareMarkdown(source: string): PreparedMarkdown {
  const markdown = splitFences(source.replace(/\r\n/g, '\n')).map((block) => {
    if (block.code) return block.text
    return loosenChineseBlocks(prepareText(block.text))
  }).join('')
  return { markdown, math: collectDelimitedMath(markdown) }
}

export function replaceMathPlaceholders(
  text: string,
  math: readonly PreparedMath[],
  render: (item: PreparedMath, index: number) => unknown,
) {
  const pattern = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g
  const parts: unknown[] = []
  let last = 0
  let match: RegExpExecArray | null
  let index = 0
  while ((match = pattern.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    const item = math[index]
    parts.push(item ? render(item, index) : match[0])
    index += 1
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}
