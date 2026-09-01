import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, root), 'utf8')

const ruleNames = [
  '00-architecture-core.mdc',
  '10-path-generation.mdc',
  '20-knowledge-lifecycle.mdc',
  '30-authors.mdc',
  '40-visualization-3d.mdc',
  '50-frontend-runtime-ui.mdc',
  '60-backend-platform.mdc',
  '70-prototype-migration.mdc',
  '80-testing-quality.mdc',
  '90-docs-rules.mdc',
]

const providerKeys = [
  'DEEPSEEK_API_KEY',
  'DEEPSEEK_BASE_URL',
  'DEEPSEEK_MODEL_NAME',
  'ZHIHU_ACCESS_SECRET',
  'ZHIHU_API_BASE_URL',
]

test('Cursor rules expose complete progressive-disclosure metadata', async () => {
  const actual = (await readdir(new URL('.cursor/rules/', root)))
    .filter((name) => name.endsWith('.mdc'))
    .sort()

  assert.deepEqual(actual, ruleNames)

  for (const name of actual) {
    const source = await read(`.cursor/rules/${name}`)
    const frontmatter = source.match(/^---\n([\s\S]*?)\n---\n/)

    assert.ok(frontmatter, `${name} must start with frontmatter`)
    assert.match(frontmatter[1], /^description: "[^"\n]+"$/m)
    assert.match(frontmatter[1], /^globs: "[^"\n]+"$/m)
    assert.match(frontmatter[1], /^alwaysApply: false$/m)
    assert.ok(source.split(/\r?\n/).length - 1 < 500, `${name} must remain focused`)
  }
})

test('AGENTS routes every rule and keeps the six frozen product invariants', async () => {
  const agents = await read('AGENTS.md')

  for (const name of ruleNames) assert.match(agents, new RegExp(name.replace('.', '\\.')))
  for (const invariant of [
    '路线不创建知识脉络',
    '首次回复永久保留',
    '问博主固定 Zhihu-first',
    '博主搜索固定 network-first',
    '刘看山不是博主',
    '重构运行时只使用真实数据',
  ]) assert.ok(agents.includes(invariant), `missing invariant: ${invariant}`)
})

test('AGENTS, README and reference audit agree on lifecycle and author ordering', async () => {
  const documents = await Promise.all(['AGENTS.md', 'README.md', 'REFERENCE_AUDIT.md'].map(read))

  for (const source of documents) {
    assert.match(source, /canonical/)
    assert.match(source, /初始回复|首次回复/)
    assert.match(source, /1–2/)
    assert.match(source, /刘看山/)
    assert.match(source, /network-first|网络优先/)
    assert.match(source, /最多返回 3 位|最多 3 位|最多 3/)
    assert.match(source, /真实 provider|真实数据|真实知乎/)
  }
})

test('real-provider configuration is server-only and examples contain no values', async () => {
  const [example, backend, readme, audit, ignore] = await Promise.all([
    read('.env.example'),
    read('.cursor/rules/60-backend-platform.mdc'),
    read('README.md'),
    read('REFERENCE_AUDIT.md'),
    read('.gitignore'),
  ])
  const entries = example
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.split('='))

  assert.deepEqual(entries.map(([key]) => key).sort(), providerKeys)
  assert.ok(entries.every(([, value]) => value === ''), '.env.example must never contain secrets')
  for (const key of providerKeys) {
    assert.ok(backend.includes(key), `${key} missing from backend rule`)
    assert.ok(readme.includes(key), `${key} missing from README`)
    assert.ok(audit.includes(key), `${key} missing from reference audit`)
  }
  assert.match(backend, /服务端|server/)
  assert.match(backend, /不得.*浏览器|浏览器.*不得/)
  assert.match(ignore, /^\.env$/m)
  assert.match(ignore, /^!\.env\.example$/m)
})

test('governance command and evidence boundary stay explicit', async () => {
  const [packageSource, readme, audit] = await Promise.all([
    read('package.json'),
    read('README.md'),
    read('REFERENCE_AUDIT.md'),
  ])
  const pkg = JSON.parse(packageSource)

  assert.equal(pkg.scripts['check:product-invariants'], 'node --test tests/architecture-governance.test.mjs')
  assert.equal(pkg.scripts['check:architecture'], 'node --test tests/architecture-baseline.test.mjs')
  assert.equal(
    pkg.scripts['check:contracts'],
    'node --test packages/contracts/tests/*.test.mjs tests/runtime-contracts-compat.test.mjs',
  )
  assert.ok(Array.isArray(pkg.workspaces) && pkg.workspaces.includes('packages/*'))
  assert.match(pkg.engines?.node ?? '', /24/)
  assert.equal(typeof pkg.dependencies?.react, 'string')
  assert.equal(typeof pkg.devDependencies?.vite, 'string')
  for (const command of Object.values(pkg.scripts)) {
    assert.doesNotMatch(command, /zhihu_thread_chatbot|zhihu_ux_ui|zhihu_3D_path|交互图/)
    assert.doesNotMatch(command, /\.\.\/\.\.\/.*node_modules/)
  }
  assert.match(readme, /当前明确未完成/)
  assert.match(audit, /当前未达到的完成条件/)
  assert.match(readme, /不能.*证明|不能证明/)
  assert.match(audit, /不能.*证明|不能证明/)
})
