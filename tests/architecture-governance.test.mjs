import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { checkDocumentation, inspectMarkdown, parseRule, validateDocuments } from '../scripts/check-documentation.mjs'

const read = name => readFile(new URL(`../${name}`, import.meta.url), 'utf8')
const repository = checkDocumentation()

test('maintained documentation links, anchors, commands and rule globs resolve in the current repository', async () => {
  const result = await repository
  assert.deepEqual(result.errors, [])
  assert.equal(result.rules.size, 10)
})

test('representative implementation files receive all applicable domain rules', async () => {
  const { rules, files } = await repository
  const cases = {
    'src/path-planning/chat-route-panel.tsx': ['00', '10', '50', '80'],
    'src/learning-v2/Workspace.tsx': ['00', '20', '50', '80'],
    'server/durable/authors-search.ts': ['00', '30', '60', '80'],
    'server/agent-runtime/prompts.ts': ['00', '10', '20', '30', '60', '80'],
    'src/path-3d/path-3d-stage.tsx': ['00', '10', '40', '50', '80'],
    'src/learning-v2/account-storage.ts': ['00', '20', '50', '70', '80'],
    'tests/product-invariants.test.mjs': ['80'],
    'docs/agents.md': ['90'],
    'qa/reading-lab.html': ['80'],
    '.env.example': ['60'],
  }
  for (const [file, required] of Object.entries(cases)) {
    assert.ok(files.includes(file), `representative file disappeared: ${file}`)
    const matched = [...rules].filter(([, globs]) => globs.some(glob => path.matchesGlob(file, glob))).map(([name]) => path.basename(name).slice(0, 2))
    for (const prefix of required) assert.ok(matched.includes(prefix), `${file} must receive rule ${prefix}`)
  }
})

test('documentation checker detects real broken targets, headings, fences and commands without enforcing prose', () => {
  const files = ['README.md', 'docs/guide.md', 'assets/screen.png']
  const good = new Map([
    ['README.md', '# Start\n\n[中文](docs/guide.md#快速开始)\n\n[duplicate](docs/guide.md#快速开始-1)\n\n![screen](assets/screen.png)\n\n`npm run check`\n'],
    ['docs/guide.md', '# 快速开始\n\n## 快速开始\n\n[Back](../README.md#start)\n'],
  ])
  assert.deepEqual(validateDocuments(good, files, { check: 'tsc -b' }), [])
  for (const [content, expected] of [
    ['[lost](docs/missing.md)', 'missing link target'],
    ['[heading](docs/guide.md#absent)', 'missing heading'],
    ['[outside](../private.md)', 'escapes repository'],
    ['[bad](docs/%ZZ.md)', 'malformed link'],
    ['`npm run missing`', 'unknown npm script'],
    ['```sh\nnpm run check\n', 'unclosed code fence'],
    ['# Title  \n', 'trailing whitespace'],
    ['<<<<<<< HEAD\n', 'merge marker'],
    ['| A | B |\n| --- | --- |\n| only one |\n', 'table row column count'],
  ]) {
    const docs = new Map(good); docs.set('README.md', '# Start\n\n' + content)
    assert.ok(validateDocuments(docs, files, { check: 'tsc -b' }).some(error => error.includes(expected)), expected)
  }
  assert.deepEqual(inspectMarkdown('```text\n[example](not-a-file)\n```\n').links, [])
  assert.deepEqual(inspectMarkdown('| A | B |\n| --- | --- |\n| escaped \\| pipe | value |\n').errors, [])
})

test('rule metadata rejects always-on, duplicate and invalid fields', () => {
  const valid = '---\ndescription: "Scope"\nglobs: "src/**"\nalwaysApply: false\n---\n# Rule\n'
  assert.deepEqual(parseRule(valid), ['src/**'])
  for (const source of [valid.replace('false', 'true'), valid.replace('src/**', ''), valid.replace('src/**', 'src/**,src/**'), valid.replace('---\n#', 'globs: "server/**"\n---\n#'), valid.replace('description:', 'unknown:')]) assert.throws(() => parseRule(source))
})

test('environment example keys are unique, credential-free and documented at their configuration owner', async () => {
  const [example, configuration, ignore] = await Promise.all(['.env.example', 'docs/configuration.md', '.gitignore'].map(read))
  const entries = example.split(/\r?\n/).filter(line => line && !line.startsWith('#')).map(line => line.split('='))
  assert.ok(entries.length > 0)
  assert.equal(new Set(entries.map(([key]) => key)).size, entries.length)
  for (const [key, value, extra] of entries) {
    assert.match(key, /^[A-Z][A-Z0-9_]+$/)
    assert.equal(value, key === 'DEEPSEEK_MODEL_NAME' ? 'deepseek-flash' : '', `${key} must not commit credentials`)
    assert.equal(extra, undefined)
    assert.ok(configuration.includes(`\`${key}\``), `${key} is missing from configuration.md`)
  }
  assert.ok(ignore.split('\n').includes('.env'))
  assert.ok(ignore.split('\n').includes('!.env.example'))
})

test('documentation index reaches maintained guides and Agent sections have unique sequential numbers', async () => {
  const { documents } = await repository
  const index = inspectMarkdown(documents.get('docs/README.md'))
  const linked = new Set(index.links.map(link => link.url))
  for (const name of documents.keys()) if (name.startsWith('docs/') && name !== 'docs/README.md') assert.ok(linked.has(name.slice(5)), `${name} needs a docs index entry`)
  const sections = inspectMarkdown(documents.get('docs/agents.md')).tree.children.filter(node => node.type === 'heading' && node.depth === 2)
  const numbers = sections.map(node => Number(node.children[0].value.match(/^(\d+)\./)?.[1]))
  assert.deepEqual(numbers, Array.from({ length: sections.length }, (_, index) => index))
})
