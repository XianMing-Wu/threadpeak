import {decodeMathEncoding,wrapMathIslands} from './math-normalize.ts'
import { prepareSourceImages, protectedSourceRanges, mathFencesToDelimiters } from './source-image.ts'
import { fenceUnfencedCode } from './unfenced-code.ts'
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
  let cursor = 0
  const prose = (text: string) => {
    for (const block of text.split(/(https?:\/\/[^\s<>]+|[A-Za-z]:\\[^\s]+)/g)) {
      if (block) parts.push({ code: /^(?:https?:|[A-Za-z]:\\)/.test(block), text: block })
    }
  }
  for (const [start, end] of protectedSourceRanges(source)) {
    prose(source.slice(cursor, start))
    parts.push({ code: true, text: source.slice(start, end) })
    cursor = end
  }
  prose(source.slice(cursor))
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
  return display ? `\n\n$$\n${tex}\n$$\n\n` : `$${tex}$`
}

/** Only recover a named space after a math separator and before a new expression.
 * Literal words inside text/operator labels are not LaTeX commands.
 */
function repairMathSpacing(tex: string) {
  const repair = (part: string) => part.replace(/([,;][ \t]*)(qquad|quad)\b(?=[ \t]*(?:\\[A-Za-z]+|[A-Za-z][A-Za-z0-9_{}^'()+\-]*[ \t]*=))/g, '$1\\$2')
  const labels = /\\(?:text[a-z]*|operatorname\*?)\s*\{/g
  let result = '', cursor = 0, match: RegExpExecArray | null
  while ((match = labels.exec(tex))) {
    let end = labels.lastIndex, depth = 1
    while (end < tex.length && depth) {
      if (tex[end] === '\\') { end += Math.min(2, tex.length - end); continue }
      if (tex[end] === '{') depth++
      if (tex[end] === '}') depth--
      end++
    }
    result += repair(tex.slice(cursor, match.index)) + tex.slice(match.index, end)
    cursor = end
    labels.lastIndex = end
  }
  return result + repair(tex.slice(cursor))
}

function wrapJoinedMatrixLines(text: string) {
  return text.replace(/[^\n]+/g, (line) => {
    if (line.includes('%%TPMATH') || !/[,;][ \t]*\\?(?:qquad|quad)\b/.test(line)) return line
    if (!/\\begin\{(?:matrix|pmatrix|bmatrix|vmatrix)\}[\s\S]*\\end\{(?:matrix|pmatrix|bmatrix|vmatrix)\}/.test(line)) return line
    // Wrap the entire connected expression before matrices become protected slots.
    // This also retains operators and their arguments, e.g. \dim\ker(D-I)=1.
    return wrapMathIslands(repairMathSpacing(line))
  })
}

function protectDelimited(text: string, slots: string[]) {
  return text.replace(/\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|(?<!\\)\$([^$\n]+?)(?<!\\)\$|\\\((.+?)\\\)/g, (_all, displayA, displayB, inlineA, inlineB, offset) => {
    if(inlineA!=null&&/^(?:\d[\d.,]*\s+(?:and|or|USD|美元|元)|.*\b(?:dollars|price)\b)/i.test(inlineA))return _all.replace(/\$/g,'\\$')
    const raw = String(displayA ?? displayB ?? inlineA ?? inlineB ?? '')
    const tex = repairMathSpacing(raw.trim())
    if (!tex) return ''
    const before=text.slice(0,offset).split(/\n\s*\n/).at(-1)??''
    const attachedMatrix=/\\begin\{(?:matrix|pmatrix|bmatrix|vmatrix)\}/.test(tex)&&/=\s*\$?\s*$/.test(before)
    const display = !attachedMatrix && (displayA != null || displayB != null) && (raw.includes('\n') || !isShortInlineMath(tex))
    const index = slots.length
    slots.push(dollars(display?tex:tex.replace(/\n/g,' '), display))
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
  return text.replace(/%%TPMATH\d+%%(?:[ \t]*(?:[=+−\-<>≤≥≠][ \t]*)?%%TPMATH\d+%%)+/g, (run) => {
    const indexes = [...run.matchAll(/%%TPMATH(\d+)%%/g)].map((match) => Number(match[1]))
    if (indexes.length < 2) return run
    const values = indexes.map((index) => slots[index] ?? '')
    if (!values.every((value) => isInlineDollar(value))) return run
    const index = slots.length
    slots.push(`$${run.replace(/%%TPMATH(\d+)%%/g,(_all,i)=>slots[Number(i)]!.slice(1,-1))}$`)
    return SLOT(index)
  })
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
    const pattern = /\$\$([\s\S]+?)\$\$|(?<!\\)\$([^$\n]+?)(?<!\\)\$/g
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
  const decoded=normalizeXrightarrow(decodeMathEncoding(text)).replace(/([A-Za-z])\{'\}/g,"$1'")
  const closed=decoded.replace(/(^|\n)(\s*\$\$?)([^$\n]+)$/g,(all,start,delimiter,tex)=>/[=^_\\]/.test(tex)?`${start}${delimiter}${tex}${delimiter.trim()}`:all)
  const protectedText = protectDelimited(wrapJoinedMatrixLines(protectDelimited(closed, slots)), slots)
  // Matrices inside prose belong to the surrounding equation, not a new block.
  const environments=protectDelimited(protectedText.replace(/(\\left\s*(?:\\[{}]|[([|])\s*)?\\begin\{(matrix|pmatrix|bmatrix|vmatrix|array|cases|aligned|align\*?)\}([\s\S]*?)\\end\{\2\}(?:\s*\\right\s*(?:\\[{}]|[)\]|.]))?(?:\s*\\tag\{[^{}]*\})?/g,(all,left,kind,body,offset)=>{
    const line=protectedText.slice(protectedText.lastIndexOf('\n',offset-1)+1,offset)
    const inline=!/^(?:aligned|align)/.test(kind)&&(/\S/.test(line)||!!left)
    return inline?`$${all.replace(/\n/g,' ')}$`:`$$\n${all}\n$$`
  }),slots)
  const islands=protectDelimited(wrapMathIslands(environments),slots)
  // Include an otherwise bare left-hand side (P=, [v]_E=) in the same math box.
  const connected=islands.replace(/((?:\[[A-Za-z][A-Za-z0-9]*\]|[A-Za-z])[A-Za-z0-9_{}^'\[\](). +\-]*=[ \t]*)(%%TPMATH\d+%%)/g,(all,lhs,slot)=>{
    const value=slots[Number(/\d+/.exec(slot)![0])]
    if(!value||!isInlineDollar(value)||/[A-Za-z]{3,}/.test(lhs))return all
    const index=slots.length;slots.push(`$${lhs}${value.slice(1,-1)}$`);return SLOT(index)
  })
  const restored=restoreSlots(mergeAdjacentSlots(wrapBareMath(connected, slots),slots), slots)
  // Equation numbering is a display-only TeX command. Keep the whole equation intact.
  const numbered=restored.replace(/(?<!\$)\$(?!\$)([^$\n]+)\$[ \t]*([.,]?)[ \t]*\$(\\tag\{[^{}]*\})\$(?!\$)/g,(_all,tex,punctuation,tag)=>dollars(`${tex}${punctuation}${tag}`,true))
  return numbered.replace(/(?<!\$)\$(?!\$)([^$\n]*\\tag\{[^{}]*\}[^$\n]*)\$(?!\$)/g,(_all,tex)=>dollars(tex,true))
}

export function prepareMarkdown(source: string): PreparedMarkdown {
  const normalized=mathFencesToDelimiters(fenceUnfencedCode(prepareSourceImages(fenceUnfencedCode(source))))
  // Long snake_case names in prose are identifiers. Short x_i remains math;
  // explicit mathematical delimiters and TeX groups retain their authority.
  const identifiers = splitFences(normalized).map(block => block.code ? block.text : block.text.split(/(\$\$[\s\S]*?\$\$|(?<!\\)\$[^$\n]+\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/g).map((part,i) => {
    if(i%2)return part
    // Literal programming separators are not bare LaTeX. Keep their visible
    // backslashes; explicit math, \nu, \nabla and existing code retain authority.
    const escaped=part.replace(/(?<![A-Za-z\\])(?:\\[nrt0])+(?![A-Za-z])/g,token=>'`'+token+'`')
    return /\\[A-Za-z]+/.test(escaped)?escaped:escaped.replace(/(?<![A-Za-z0-9_])[A-Za-z]{2,}_[A-Za-z][A-Za-z0-9_]+(?![A-Za-z0-9_])/g,name=>'`'+name+'`')
  }).join('')).join('')
  const markdown = splitFences(identifiers.replace(/\r\n/g, '\n')).map((block) => {
    if (block.code) return block.text
    return loosenChineseBlocks(prepareText(block.text))
  }).join('')
  // GFM splits table cells before remark-math runs. Shield TeX's vertical bars
  // (determinants, norms, array borders) without changing their mathematical meaning.
  const safeMarkdown = splitFences(markdown).map(block => block.code ? block.text : block.text.replace(/\$\$([\s\S]+?)\$\$|(?<!\\)\$([^$\n]+?)(?<!\\)\$/g, expression => expression.replace(/\|/g, '&#124;'))).join('')
  return { markdown: safeMarkdown, math: collectDelimitedMath(markdown) }
}

export function replaceMathPlaceholders(
  text: string,
  math: readonly PreparedMath[],
  render: (item: PreparedMath, index: number) => unknown,
) {
  const pattern = /\$\$([\s\S]+?)\$\$|(?<!\\)\$([^$\n]+?)(?<!\\)\$/g
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
