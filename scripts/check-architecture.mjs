import assert from 'node:assert/strict'
import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const forbiddenPathPatterns = [
  /zhihu_thread_chatbot/,
  /zhihu_ux_ui/,
  /zhihu_3D_path/,
  /(?:^|[/'"`\s])交互图(?:\/|$)/,
  /\.\.\/\.\.\/(?:zhihu_|交互图)/,
]

const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css'])
const skipDirectoryNames = new Set(['node_modules', 'dist', '.git', '.vite'])
const skipFileFragments = [
  `${path.sep}src${path.sep}vendor${path.sep}learning-path-3d${path.sep}`,
]

const importPattern = /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)|new URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url/g

function isSkippedFile(filePath) {
  return skipFileFragments.some((fragment) => filePath.includes(fragment))
}

function assertInRepo(filePath, via) {
  const resolved = path.resolve(filePath)
  if (!resolved.startsWith(`${repoRoot}${path.sep}`) && resolved !== repoRoot) {
    throw new Error(`${via} escapes the repository: ${resolved}`)
  }
  for (const pattern of forbiddenPathPatterns) {
    if (pattern.test(resolved)) {
      throw new Error(`${via} resolves into forbidden sibling path (${pattern}): ${resolved}`)
    }
  }
}

async function walkFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (!skipDirectoryNames.has(entry.name)) files.push(...await walkFiles(fullPath))
      continue
    }
    if (sourceExtensions.has(path.extname(entry.name))) files.push(fullPath)
  }
  return files
}

function specifiersIn(source) {
  const found = []
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1] ?? match[2] ?? match[3] ?? match[4]
    if (specifier) found.push(specifier)
  }
  return found
}

function stripResourceQuery(specifier) {
  return specifier.replace(/[?#].*$/, '')
}

function resolveSpecifier(fromFile, specifier) {
  const bare = stripResourceQuery(specifier)
  if (bare.startsWith('node:') || bare.startsWith('data:')) return null
  if (bare.startsWith('.') || bare.startsWith('/')) {
    return path.resolve(path.dirname(fromFile), bare)
  }
  if (bare === '@threadpeak/contracts' || bare.startsWith('@threadpeak/contracts/')) {
    return path.join(repoRoot, 'packages/contracts/src/index.ts')
  }
  if (bare === '@threadpeak/api-client' || bare.startsWith('@threadpeak/api-client/')) {
    return path.join(repoRoot, 'packages/api-client/src/index.ts')
  }
  if (bare === '@threadpeak/runtime-store' || bare.startsWith('@threadpeak/runtime-store/')) {
    return path.join(repoRoot, 'packages/runtime-store/src/index.ts')
  }
  if (bare === 'liu-kanshan-learning-path-3d') {
    return path.join(repoRoot, 'src/vendor/learning-path-3d/index.js')
  }
  if (bare.startsWith('organic-mindmap/')) {
    return path.join(repoRoot, 'vendor/charts', bare)
  }
  if (bare.startsWith('sunburst-chart/')) {
    return path.join(repoRoot, 'vendor/charts', bare)
  }
  if (bare.startsWith('wine-timeline/')) {
    return path.join(repoRoot, 'vendor/charts', bare)
  }
  return null
}

async function assertFileExists(resolved, specifier, fromFile) {
  const withoutJs = resolved.endsWith('.js') ? resolved.slice(0, -3) : resolved
  const candidates = [
    resolved,
    `${withoutJs}.ts`,
    `${withoutJs}.tsx`,
    `${resolved}.ts`,
    `${resolved}.tsx`,
    `${resolved}.js`,
    `${resolved}.jsx`,
    `${resolved}.mjs`,
    path.join(resolved, 'index.js'),
    path.join(resolved, 'index.ts'),
  ]
  for (const candidate of candidates) {
    try {
      const info = await stat(candidate)
      if (info.isFile() || info.isDirectory()) return
    } catch {
      // try next
    }
  }
  throw new Error(`unresolved local import ${JSON.stringify(specifier)} from ${path.relative(repoRoot, fromFile)}`)
}

export async function checkArchitecture() {
  const configFiles = [
    'package.json',
    'vite.config.ts',
    'tsconfig.json',
    'index.html',
    'path-lab.html',
  ].map((relative) => path.join(repoRoot, relative))

  const sourceRoots = ['src', 'tests', 'scripts', 'packages'].map((relative) => path.join(repoRoot, relative))
  const sourceFiles = (await Promise.all(sourceRoots.map(walkFiles))).flat()
    .filter((filePath) => !isSkippedFile(filePath))

  const graph = new Map()

  for (const filePath of [...configFiles, ...sourceFiles]) {
    const relative = path.relative(repoRoot, filePath)
    const source = await readFile(filePath, 'utf8')
    const scanSourceText = !relative.startsWith(`tests${path.sep}`)
      && relative !== path.join('scripts', 'check-architecture.mjs')
    if (scanSourceText) {
      for (const pattern of forbiddenPathPatterns) {
        assert.equal(pattern.test(source), false, `${relative} still references sibling path ${pattern}`)
      }
    }

    const edges = []
    for (const specifier of specifiersIn(source)) {
      for (const pattern of forbiddenPathPatterns) {
        assert.equal(pattern.test(specifier), false, `${relative} imports sibling specifier ${specifier}`)
      }
      const resolved = resolveSpecifier(filePath, specifier)
      if (!resolved) continue
      assertInRepo(resolved, `${relative} -> ${specifier}`)
      if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.includes('/')) {
        await assertFileExists(resolved, specifier, filePath)
      }
      edges.push({ specifier, resolved: path.relative(repoRoot, resolved) })
    }
    graph.set(relative, edges)
  }

  const pkg = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'))
  assert.ok(pkg.engines?.node?.includes('24'), 'package.json must declare Node >=24')
  assert.equal(typeof pkg.dependencies?.react, 'string')
  assert.equal(typeof pkg.devDependencies?.vite, 'string')
  for (const [name, command] of Object.entries(pkg.scripts)) {
    assert.equal(command.includes('node_modules/'), false, `script ${name} must use PATH binaries, not sibling node_modules`)
    assert.equal(command.includes('../'), false, `script ${name} must not leave the repository`)
  }

  return {
    files: graph.size,
    edges: [...graph.values()].reduce((count, edges) => count + edges.length, 0),
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const summary = await checkArchitecture()
  process.stdout.write(`architecture ok files=${summary.files} edges=${summary.edges}\n`)
}
