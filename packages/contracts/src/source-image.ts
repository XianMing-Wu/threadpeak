import { fromMarkdown } from 'mdast-util-from-markdown'
import type { RootContent, Definition } from 'mdast'
import { renderMath, normalizeTex, decodeMathEncoding } from './math-normalize.ts'

/** Images are untrusted source data, never HTML to inject into the document. */
export function safeSourceImageUrl(value: string | undefined): string | undefined {
  if (!value || value.length > 8192 || /[\s\\\u0000-\u001f\u007f]/.test(value) || /%(?![\da-f]{2})/i.test(value)) return
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return
    // Never turn imported images into requests to local devices or privileged URL schemes.
    if (!host.includes('.') || host.endsWith('.') || host.startsWith('[') || /^[\d.]+$/.test(host)
      || /(?:^|\.)(?:localhost|local|internal|intranet|lan|home|corp|test|invalid)$/.test(host)) return
    return url.href
  } catch { return }
}

function decodeAttribute(text: string): string {
  const named: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', bsol: '\\', dollar: '$' }
  return text.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp|bsol|dollar);/gi, (all, entity: string) => {
    if (!entity.startsWith('#')) return named[entity.toLowerCase()] ?? all
    const code = entity[1]?.toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1))
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '\ufffd'
  })
}

type ImageSource = { src?: string; alt?: string; title?: string; className?: string; latex?: string }
const mathCue = /\\[a-zA-Z]+|\$[^$]+\$|[A-Za-z0-9][_^=<>≤≥≠]|[A-Za-z]\s*[=<>≤≥≠]\s*\S/

export function sourceImageInfo(image: ImageSource) {
  const src = safeSourceImageUrl(image.src)
  let urlTex = ''
  if (src) {
    const url = new URL(src)
    if ((url.hostname === 'zhihu.com' || url.hostname.endsWith('.zhihu.com')) && url.pathname === '/equation') {
      urlTex = url.searchParams.get('tex') ?? ''
    }
  }
  const labelledMath = /(?:^|[\s_-])(?:eeimg|equation|math|latex)(?:$|[\s_-])/i.test(image.className ?? '')
    || !!urlTex || !!image.latex || image.alt === '公式图片'
  const alt = image.alt?.trim() ?? ''
  const candidate = [image.latex, alt, urlTex, labelledMath ? image.title : undefined].map((value) => decodeMathEncoding(value ?? '')).find((value) => value.trim()
    && !/^(?:true|false|1|0|公式|数学公式|equation|math|latex)$/i.test(value.trim())
    && !/<\/?[a-z][^>]*>/i.test(value)
    && (labelledMath || value.trim().startsWith('\\') || !/[\u3400-\u9fff]|\b[a-z]{3,}\s+[a-z]/i.test(value))
    && (mathCue.test(value) || (labelledMath && /^[A-Za-z0-9+−*/().\s-]{1,80}$/.test(value))))
  const tex = candidate ? normalizeTex(candidate).replace(/\r?\n/g, ' ') : undefined
  return { src, alt, tex, formula: labelledMath || !!tex }
}

function attributes(tag: string): Record<string, string> {
  const values: Record<string, string> = Object.create(null)
  const body = tag.replace(/^<\s*img\b/i, '').replace(/\/?\s*>$/, '')
  const pattern = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`]+)))?/g
  for (const match of body.matchAll(pattern)) {
    const key = match[1]!.toLowerCase()
    if (!(key in values)) values[key] = decodeAttribute(match[2] ?? match[3] ?? match[4] ?? '')
  }
  return values
}

function escapeLabel(text: string) { return text.replace(/\r?\n/g, ' ').replace(/[\\\[\]<>`]/g, '\\$&') }
function imageMarkdown(image: ImageSource): string {
  const info = sourceImageInfo(image)
  if (info.tex && renderMath(info.tex, false).kind === 'rendered') return `$${info.tex}$`
  // Empty/blocked URLs still produce a visible image fallback, rather than an empty string.
  const label = info.tex || info.alt || (info.formula ? '公式图片' : '资料图片')
  return `![${escapeLabel(label)}](<${info.src ?? ''}>)`
}

const tagPattern = /<!--[\s\S]*?(?:-->|$)|<\/?[A-Za-z][^<>"']*(?:(?:"[^"]*"|'[^']*')[^<>"']*)*>/g
const inertContainers = new Set(['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'template', 'textarea', 'xmp', 'noscript'])

/** Read only img metadata; unwrap basic source formatting without enabling raw HTML. */
function htmlImages(html: string): string {
  let output = '', cursor = 0
  const blocked: string[] = []
  for (const match of html.matchAll(tagPattern)) {
    if (!blocked.length) output += html.slice(cursor, match.index)
    cursor = match.index! + match[0].length
    const token = match[0]
    if (token.startsWith('<!--')) continue
    const name = /^<\/?([\w-]+)/.exec(token)?.[1]?.toLowerCase() ?? ''
    const closing = /^<\//.test(token)
    if (blocked.length) {
      if (closing && name === blocked.at(-1)) blocked.pop()
      else if (!closing && inertContainers.has(name) && !/\/>$/.test(token)) blocked.push(name)
      continue
    }
    if (inertContainers.has(name)) { if (!closing && !/\/>$/.test(token) && name !== 'embed') blocked.push(name); continue }
    if (name === 'img' && !closing) {
      const a = attributes(token)
      const src = [a['data-actualsrc'], a.src, a['data-original'], a['data-src']].find((value) => safeSourceImageUrl(value))
      const explicitTex = [a['data-latex'], a['data-tex'], a['data-eeimg']].find((value) => value && !/^(?:true|false|1|0)$/i.test(value))
      output += imageMarkdown({ src, alt: a.alt, title: a.title, className: a.class, latex: explicitTex })
    } else if (name === 'br' || /^(?:p|div|section|article|h[1-6]|li|blockquote|figure|figcaption)$/.test(name)) output += '\n\n'
    // Other tags, including attributes and handlers, are never forwarded to React.
  }
  if (!blocked.length) output += html.slice(cursor)
  return output
}

type Edit = { start: number; end: number; value: string }
function applyEdits(source: string, edits: Edit[]) {
  let result = '', cursor = 0
  for (const edit of edits.sort((a, b) => a.start - b.start)) {
    if (edit.start < cursor) continue
    result += source.slice(cursor, edit.start) + edit.value
    cursor = edit.end
  }
  return result + source.slice(cursor)
}

/** Use CommonMark positions so code samples, reference links and balanced image URLs stay intact. */
export function prepareSourceImages(source: string): string {
  if (!/<|!\[/.test(source)) return source
  const ast = fromMarkdown(source)
  const definitions = new Map<string, Definition>()
  for (const node of ast.children) if (node.type === 'definition' && !definitions.has(node.identifier)) definitions.set(node.identifier, node)
  const edits: Edit[] = []
  const htmlLiterals: Array<[number, number]> = []
  const protectHtml = (node: RootContent) => {
    if (node.type === 'code' || node.type === 'inlineCode') return
    if (node.type === 'html') {
      for (const token of node.value.matchAll(tagPattern)) {
        const name = /^<([\w-]+)/.exec(token[0])?.[1]?.toLowerCase()
        if (!name || (!inertContainers.has(name) && name !== 'code' && name !== 'pre')) continue
        const start = (node.position?.start.offset ?? 0) + token.index!
        if (htmlLiterals.some(([a, b]) => start >= a && start < b)) continue
        const contentStart = start + token[0].length
        const closing = new RegExp(`</${name}\\s*>`, 'i').exec(source.slice(contentStart))
        const end = name === 'embed' ? contentStart : closing ? contentStart + closing.index + closing[0].length : source.length
        htmlLiterals.push([start, end])
        let value = ''
        if (name === 'code' || name === 'pre') {
          const content = decodeAttribute(source.slice(contentStart, closing ? contentStart + closing.index : end).replace(/^<code[^>]*>|<\/code>$/gi, ''))
          const fence = '`'.repeat(Math.max(name === 'pre' ? 3 : 1, ...[...content.matchAll(/`+/g)].map((m) => m[0].length + 1)))
          value = name === 'pre' ? `\n\n${fence}\n${content}\n${fence}\n\n` : `${fence} ${content} ${fence}`
        }
        edits.push({ start, end, value })
      }
    } else if ('children' in node) node.children.forEach(protectHtml)
  }
  ast.children.forEach(protectHtml)
  const walk = (node: RootContent) => {
    const start = node.position?.start.offset, end = node.position?.end.offset
    if (start == null || end == null || node.type === 'code' || node.type === 'inlineCode') return
    if (htmlLiterals.some(([a, b]) => start >= a && end <= b)) return
    if (node.type === 'image' || node.type === 'imageReference') {
      const definition = node.type === 'imageReference' ? definitions.get(node.identifier) : node
      if (definition) edits.push({ start, end, value: imageMarkdown({ src: definition.url, alt: node.alt ?? '', title: definition.title ?? '' }) })
      return
    }
    if (node.type === 'html') {
      // Process only the portions outside protected HTML code / inert containers.
      let cursor = start
      for (const [a, b] of htmlLiterals.filter(([a, b]) => a < end && b > start).sort((a, b) => a[0] - b[0])) {
        if (a > cursor) edits.push({ start: cursor, end: a, value: htmlImages(source.slice(cursor, a)) })
        cursor = Math.max(cursor, b)
      }
      if (cursor < end) edits.push({ start: cursor, end, value: htmlImages(source.slice(cursor, end)) })
      return
    }
    if ('children' in node) node.children.forEach(walk)
  }
  ast.children.forEach(walk)
  return applyEdits(source, edits)
}

/** Ranges which must not be modified by bare-LaTeX recovery. */
export function protectedSourceRanges(source: string, options: { indentedCode?: boolean } = {}): Array<[number, number]> {
  const ranges: Array<[number, number]> = []
  const walk = (node: RootContent) => {
    if (node.type === 'code' && options.indentedCode === false && !/^ {0,3}(?:`{3,}|~{3,})/.test(source.slice(node.position?.start.offset ?? 0))) return
    if (['code', 'inlineCode', 'link', 'linkReference', 'image', 'imageReference', 'definition', 'html'].includes(node.type)) {
      const start = node.position?.start.offset
      let end = node.position?.end.offset
      if (node.type === 'html' && end != null) {
        const name = /^<([\w-]+)\b/i.exec(node.value)?.[1]?.toLowerCase()
        if (name && name !== 'embed' && (inertContainers.has(name) || name === 'code' || name === 'pre')
          && !new RegExp(`</${name}\\s*>`, 'i').test(node.value)) {
          const closing = new RegExp(`</${name}\\s*>`, 'i').exec(source.slice(end))
          end = closing ? end + closing.index + closing[0].length : source.length
        }
      }
      if (start != null && end != null) ranges.push([start, end])
      return
    }
    if ('children' in node) node.children.forEach(walk)
  }
  fromMarkdown(source).children.forEach(walk)
  const merged: Array<[number, number]> = []
  for (const range of ranges.sort((a, b) => a[0] - b[0])) {
    const previous = merged.at(-1)
    if (previous && range[0] <= previous[1]) previous[1] = Math.max(previous[1], range[1])
    else merged.push(range)
  }
  return merged
}

/** Conservative search-excerpt hint only; never repair operands or rewrite the source.
 * These literal gaps were observed in upstream summaries. Whitespace by itself is not a signal.
 */
function sourceProse(source:string) {
  let prose = '', cursor = 0
  for (const [start, end] of protectedSourceRanges(source)) {
    // A non-space barrier prevents omitted code/images/links from creating a false gap.
    prose += source.slice(cursor, start) + '\ufffc'
    cursor = end
  }
  prose += source.slice(cursor)
  return prose
}

export function hasEmptySourceMath(source:string) {
  return /(?<![\\$])\$(?!\$)[ \t\n]*\$(?!\$)|(?<!\$)\$\$[ \t\n]*\$\$(?!\$)|\\\([ \t\n]*\\\)|\\\[[ \t\n]*\\\]/.test(sourceProse(source))
}

export function sourceExcerptIssues(source: string): SourceExcerptIssue[] {
  const emptyMath=hasEmptySourceMath(source)
  if (!emptyMath&&!/即使|公式|矩阵|向量|方程|函数|交换律|结合律|分配律|概率|微积分|求导|阶导|梯度|导数|计算图/.test(source)) return []
  let prose=sourceProse(source)
  prose = prose.replace(/\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|(?<!\\)\$(?:\\.|[^$\n])*?(?<!\\)\$/g, '\ufffc')
    .replace(/&nbsp;|&#(?:160|x0*a0);/gi, '\u00a0')
  const rules: Array<[SourceExcerptIssue['code'], RegExp]> = [
    ['missing-operands', /是[ \t]*(?:一个|一组)[ \t]*的[ \t]*(?:矩阵|向量)/],
    ['missing-operands', /即使[ \t\u00a0\u3000]+和[ \t\u00a0\u3000]+都有意义/],
    ['missing-operands', /满足交换律[ \t\u00a0\u3000]{2,}和结合律/],
    ['empty-formula-list', /(?:[·•・‧][ \t\u00a0\u3000]*){3,}/],
    ['empty-formula-list', /(?:^|\n)(?:[ \t]*[-*+·•・‧][ \t]*\n){2,}/],
    ['missing-operands', /(?:设|若)[ \t\u00a0\u3000]*[,，][ \t\u00a0\u3000]*[,，]?[ \t\u00a0\u3000]*则/],
    ['empty-math-law', /(?:满足|具有)(?:交换律|结合律|分配律)[ \t]*[：:][ \t]*[，。；]/],
    ['empty-math-law', /(?:满足|具有)(?:交换律|结合律|分配律)[ \t]*[：:][ \t\n]*(?:满足|具有|示例[：:]|重要注意[：:])/],
    ['missing-operands', /(?:设[ \t]*是|[，。][ \t]*是)[ \t]*(?:矩阵|向量)[，。；]/],
  ]
  rules.push(
    ['missing-operands', /(?:例子(?:是)?|表达式(?:是)?|函数(?:为|是)?)[：:][ \t\u00a0\u3000]*[，,]/],
    ['missing-operands', /(?:计算|求导(?:得到|得)?)[ \t\u00a0\u3000]*[，,][ \t]*(?:假设|设|给定)/],
    ['missing-operands', /返回值就是[ \t\u00a0\u3000]{2,}这一梯度/],
    ['empty-formula-list', /手算的话[，,][ \t\u00a0\u3000]*[，,][ \t\u00a0\u3000]*[，,]/],
  )
  return [...new Set([...rules.filter(([,pattern]) => pattern.test(prose)).map(([code]) => code),...(emptyMath?['empty-formula-list' as const]:[])])].map(code=>({code}))
}

export type SourceExcerptIssue = {code:'missing-operands'|'empty-formula-list'|'empty-math-law'}
export function hasMissingSourceExcerptMath(source: string): boolean { return sourceExcerptIssues(source).length > 0 }

export function mathFencesToDelimiters(source: string): string {
  if (!/```|~~~/.test(source)) return source
  const edits: Edit[] = []
  const walk = (node: RootContent) => {
    if (node.type === 'code') {
      if (/^(?:latex|tex|math)$/i.test(node.lang ?? '') && node.position?.start.offset != null && node.position.end.offset != null) {
        edits.push({ start: node.position.start.offset, end: node.position.end.offset, value: `$$\n${node.value.trim()}\n$$` })
      }
    } else if ('children' in node) node.children.forEach(walk)
  }
  fromMarkdown(source).children.forEach(walk)
  return applyEdits(source, edits)
}
