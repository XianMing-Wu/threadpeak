import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fromMarkdown } from 'mdast-util-from-markdown'

const root = fileURLToPath(new URL('../', import.meta.url))
const ignored = new Set(['node_modules', '.git', '.tmp-chrome', '.data', 'dist', 'coverage', 'raw', '.vite'])

export async function repositoryFiles(directory = root, prefix = '') {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = path.posix.join(prefix, entry.name)
    if (entry.isDirectory() && !ignored.has(entry.name)) files.push(...await repositoryFiles(path.join(directory, entry.name), name))
    else if (entry.isFile()) files.push(name)
  }
  return files
}

function walk(node, visit) {
  visit(node)
  for (const child of node.children ?? []) walk(child, visit)
}
function plain(node) {
  return node.value ?? (node.children ?? []).map(plain).join('')
}

export function inspectMarkdown(source) {
  // Rules use a deliberately narrow, quoted frontmatter format.
  const content = source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, match => match.replace(/[^\n]/g, ' '))
  const tree = fromMarkdown(content), anchors = new Set(), links = [], commands = [], errors = []
  const codeLines = new Set()
  const definitions = new Map()
  walk(tree, node => { if (node.type === 'definition') definitions.set(node.identifier, node.url) })
  walk(tree, node => {
    if (node.type === 'heading') {
      const base = plain(node).toLowerCase().replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '').replace(/\s/g, '-')
      let slug = base, count = 0
      while (anchors.has(slug)) slug = `${base}-${++count}`
      anchors.add(slug)
    }
    if (['link', 'image', 'definition'].includes(node.type)) links.push({ url: node.url, line: node.position.start.line })
    if (['linkReference', 'imageReference'].includes(node.type) && !definitions.has(node.identifier)) errors.push(`line ${node.position.start.line}: undefined reference ${node.identifier}`)
    if (node.type === 'code' || node.type === 'inlineCode') {
      for (const match of node.value.matchAll(/\bnpm\s+run\s+([\w:-]+)/g)) commands.push(match[1])
    }
    if (node.type === 'code') {
      for (let line = node.position.start.line; line <= node.position.end.line; line++) codeLines.add(line)
      const lines = content.split('\n'), first = lines[node.position.start.line - 1]
      const fence = /^\s*(`{3,}|~{3,})/.exec(first)?.[1]
      if (fence && !new RegExp(`^\\s*${fence[0]}{${fence.length},}\\s*$`).test(lines[node.position.end.line - 1])) {
        errors.push(`line ${node.position.start.line}: unclosed code fence`)
      }
    }
  })
  for (const [index, line] of source.split('\n').entries()) {
    if (/[\t ]+$/.test(line)) errors.push(`line ${index + 1}: trailing whitespace`)
    if (/^(?:<{7}|={7}|>{7})(?:\s|$)/.test(line)) errors.push(`line ${index + 1}: merge marker`)
  }
  const lines = content.split('\n')
  const cells = line => line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(cell => cell.trim())
  for (let index = 1; index < lines.length; index++) {
    if (codeLines.has(index + 1)) continue
    const separator = cells(lines[index])
    if (separator.length < 2 || !separator.every(cell => /^:?-{3,}:?$/.test(cell))) continue
    if (cells(lines[index - 1]).length !== separator.length) errors.push(`line ${index}: table header column count`)
    for (let row = index + 1; row < lines.length && /^\s*\|/.test(lines[row]); row++) {
      if (cells(lines[row]).length !== separator.length) errors.push(`line ${row + 1}: table row column count`)
    }
  }
  return { tree, anchors, links, commands, errors }
}

export function validateDocuments(documents, files, scripts) {
  const errors = [], parsed = new Map([...documents].map(([name, source]) => [name, inspectMarkdown(source)]))
  const available = new Set(files)
  for (const [name, doc] of parsed) {
    errors.push(...doc.errors.map(error => `${name}: ${error}`))
    // Provenance documents can name commands belonging to an upstream repository.
    if (!name.startsWith('vendor/') && !name.startsWith('src/vendor/')) {
      for (const command of doc.commands) if (!(command in scripts)) errors.push(`${name}: unknown npm script ${command}`)
    }
    for (const { url, line } of doc.links) {
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(url)) continue
      try {
        const [pathname, fragment] = url.split('#'), local = decodeURIComponent(pathname.split('?')[0])
        const target = local ? path.posix.normalize(path.posix.join(path.posix.dirname(name), local)) : name
        if (local.startsWith('/') || target === '..' || target.startsWith('../')) {
          errors.push(`${name}:${line}: link escapes repository: ${url}`)
          continue
        }
        const directory = [...available].some(file => file.startsWith(target.replace(/\/$/, '') + '/'))
        if (!available.has(target) && !directory) errors.push(`${name}:${line}: missing link target ${url}`)
        else if (fragment && parsed.has(target) && !parsed.get(target).anchors.has(decodeURIComponent(fragment))) {
          errors.push(`${name}:${line}: missing heading ${url}`)
        }
      } catch { errors.push(`${name}:${line}: malformed link ${url}`) }
    }
  }
  return errors
}

export function parseRule(source) {
  const front = /^---\n([\s\S]*?)\n---\n/.exec(source)?.[1]
  if (!front) throw new Error('missing frontmatter')
  const fields = new Map()
  for (const line of front.split('\n')) {
    const match = /^(description|globs|alwaysApply): (.+)$/.exec(line)
    if (!match || fields.has(match[1])) throw new Error('invalid or duplicate frontmatter field')
    fields.set(match[1], JSON.parse(match[2]))
  }
  if (fields.size !== 3 || fields.get('alwaysApply') !== false) throw new Error('rules must be opt-in with three fields')
  if (typeof fields.get('description') !== 'string' || !fields.get('description').trim()) throw new Error('empty description')
  if (typeof fields.get('globs') !== 'string') throw new Error('invalid globs')
  const globs = fields.get('globs').split(',').map(glob => glob.trim())
  if (globs.some(glob => !glob) || new Set(globs).size !== globs.length) throw new Error('empty or duplicate glob')
  if (source.split('\n').length >= 500) throw new Error('rule exceeds 499 lines')
  return globs
}

export async function checkDocumentation(directory = root) {
  const files = await repositoryFiles(directory)
  const documents = new Map(await Promise.all(files.filter(name => /\.(?:md|mdc)$/.test(name)).map(async name => [name, await readFile(path.join(directory, name), 'utf8')])))
  const pkg = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'))
  const errors = validateDocuments(documents, files, pkg.scripts), rules = new Map()
  const agentsLinks = new Set(inspectMarkdown(documents.get('AGENTS.md')).links.map(link => link.url))
  for (const [name, source] of documents) if (name.startsWith('.cursor/rules/') && name.endsWith('.mdc')) {
    try {
      const globs = parseRule(source)
      rules.set(name, globs)
      for (const glob of globs) if (!files.some(file => path.matchesGlob(file, glob))) errors.push(`${name}: glob has no files: ${glob}`)
      if (!agentsLinks.has(name)) errors.push(`AGENTS.md: missing rule link ${name}`)
    } catch (error) { errors.push(`${name}: ${error.message}`) }
  }
  return { errors, rules, files, documents }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await checkDocumentation()
  if (result.errors.length) { process.stderr.write(result.errors.join('\n') + '\n'); process.exitCode = 1 }
  else process.stdout.write(`Checked ${result.documents.size} documents and ${result.rules.size} Cursor rules.\n`)
}
