import { protectedSourceRanges } from './source-image.ts'

// Search excerpts sometimes retain Python/JS text but drop the code fence.
// Require programming syntax, not a generic assignment such as A = B + C.
const statementStart = /^\s*(?:(?:import\s+[\w.]+(?:\s+as\s+\w+)?|from\s+[\w.]+\s+import\s+.+)\s*$|(?:const|let|var)\s+\w+\s*=|(?:def|class)\s+\w+[^\n]*:\s*$|(?:[A-Za-z_]\w*\s*=\s*)?[A-Za-z_]\w*\.[A-Za-z_]\w*\s*\()/
// Comprehensions need no import or member call. Their for/in grammar, unlike
// underscores or '=', is decisive programming evidence. Plain algebra is not.
const comprehension = /^\s*[A-Za-z_]\w*\s*=\s*[\[({][^\n]*\bfor\s+[A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*\s+in\s+/
const builtinAssignment = /^\s*[A-Za-z_]\w*\s*=\s*(?:list|dict|set|tuple|range|enumerate|zip|sorted|sum|len)\s*\(/
function codeStart(line: string) { return !/\\[A-Za-z]+/.test(line) && (statementStart.test(line) || comprehension.test(line) || builtinAssignment.test(line)) }

// Once a programming block starts, keep its assignments and output statements
// with it. A standalone algebraic assignment still cannot start a code block.
const codeContinuation = /^\s*(?:[A-Za-z_]\w*\s*=(?!=)|(?:print|len|range)\s*\(|(?:return|if|for|while)\b)/


export function fenceUnfencedCode(source: string): string {
  const literalRanges = protectedSourceRanges(source, { indentedCode: false })
  source = source.replace(/^(\s*)(\$\$?|\\\()[ \t]*(.*?)[ \t]*(?:\$\$?|\\\))[ \t]*$/gm, (line, indent, _delimiter, content, offset) =>
    !literalRanges.some(([start,end]) => start <= offset && end > offset) && codeStart(content) ? indent + content : line)
  const protectedRanges = protectedSourceRanges(source, { indentedCode: false })
  const lines = source.split('\n'), offsets: number[] = []
  let offset = 0
  for (const line of lines) { offsets.push(offset); offset += line.length + 1 }
  const protectedLine = (i: number) => protectedRanges.some(([start, end]) => start < offsets[i]! + lines[i]!.length && end > offsets[i]!)
  const result: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const lookahead = lines.slice(i, i + 12).join(' ').slice(0, 4096)
    const startsArray = /^\s*[A-Za-z_]\w*\s*=\s*[\[({]\s*$/.test(lines[i]!) && codeStart(lookahead)
    if (/^(?: {4}|\t)/.test(lines[i]!) || protectedLine(i) || !(codeStart(lines[i]!) || startsArray)) { result.push(lines[i]!); continue }
    const block: string[] = []
    const stack: string[] = []
    let quote = '', escaped = false
    const scan = (line: string) => {
      for (const c of line) {
        if (escaped) { escaped = false; continue }
        if (quote) { if (c === '\\') escaped = true; else if (c === quote) quote = ''; continue }
        if (c === '#') break
        if (c === '"' || c === "'") { quote = c; continue }
        if ('([{'.includes(c)) stack.push(c)
        if (')]}'.includes(c) && '([{'.indexOf(stack.at(-1) ?? '') === ')]}'.indexOf(c)) stack.pop()
      }
    }
    let end = i
    for (; end < Math.min(lines.length, i + 128) && !protectedLine(end); end++) {
      const line = lines[end]!
      const next = lines.slice(end + 1).find(value => value.trim()) ?? ''
      const continuedCode = !line.trim() && (codeStart(next) || codeContinuation.test(next) || /^\s*#(?!#)/.test(next))
      if (end !== i && !stack.length && !quote && !codeStart(line) && !codeContinuation.test(line) && !/^\s*#(?!#)/.test(line) && !continuedCode) break
      // A truncated array must not swallow the explanation that follows it.
      if (end !== i && (stack.length || quote) && /^[\u3400-\u9fff]/.test(line.trim())) break
      block.push(line); scan(line)
    }
    const fence = '`'.repeat(Math.max(3, ...block.flatMap(line => [...line.matchAll(/`+/g)].map(m => m[0].length + 1))))
    const language = block.some(line => /^\s*(?:const|let|var)\b/.test(line)) ? 'javascript' : 'python'
    result.push('', `${fence}${language}`, ...block, fence, '')
    i = end - 1
  }
  return result.join('\n')
}
