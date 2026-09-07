import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { SourceMap } from 'node:module'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { compileStagedPlan } from '../server/path-generation/staged-plan.ts'
import { projectRouteToDocument } from '../server/path-generation/project-document.ts'

const testDirectory = path.dirname(fileURLToPath(import.meta.url))
const frontendRoot = path.resolve(testDirectory, '..')
const vendorRoot = path.resolve(frontendRoot, 'src/vendor/learning-path-3d')

async function loadExactVendorContract() {
  const bundlePath = path.join(vendorRoot, 'index.js')
  let source = await readFile(bundlePath, 'utf8')
  const payload = JSON.parse(await readFile(`${bundlePath}.map`, 'utf8'))
  const sourceMap = new SourceMap(payload)
  const originals = new Map(payload.sources.map((name, index) => [
    name, payload.sourcesContent[index].split('\n'),
  ]))
  const contracts = new Map([
    ['validateLearningPathDocument', null],
    ['compileValidatedLearningPathDocument', null],
    ['compileLearningPathRuntime', null],
  ])
  // Discover the real bundled functions through their original declarations.
  // Minifier names change on every rebuild; the vendor file itself stays untouched.
  for (const [lineNumber, line] of source.split('\n').entries()) {
    const declaration = /^function ([$\w]+)\(/.exec(line)
    if (!declaration) continue
    const entry = sourceMap.findEntry(lineNumber, 'function '.length)
    const original = originals.get(entry.originalSource)?.[entry.originalLine]
    const name = /\bfunction ([$\w]+)\s*\(/.exec(original ?? '')?.[1]
    if (!contracts.has(name)) continue
    assert.equal(contracts.get(name), null, `ambiguous bundled contract: ${name}`)
    contracts.set(name, declaration[1])
  }
  for (const [name, symbol] of contracts) {
    assert.ok(symbol, `the exact vendor bundle must contain ${name}`)
  }
  source = source.replace(
    /from "(\.\/[^\"]+\.js)";/g,
    (_, dependency) => `from "${pathToFileURL(path.resolve(vendorRoot, dependency)).href}";`,
  )
  source += `\nexport { ${[...contracts].map(([name, symbol]) => `${symbol} as ${name}`).join(', ')} };\n`
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
  return import(moduleUrl)
}

function validDocument() {
  return {
    protocol: 'learning-path',
    version: '1.0',
    id: 'contract-path',
    metadata: { title: '合同路线', locale: 'zh-CN' },
    structure: {
      entrySubjectId: 'subject-start',
      goalSubjectIds: ['subject-goal'],
      subjects: [
        { id: 'subject-start', cardRef: 'card-start', orderHint: 1 },
        { id: 'subject-core', cardRef: 'card-core', orderHint: 2 },
        { id: 'subject-goal', cardRef: 'card-goal', orderHint: 3 },
      ],
      concepts: [
        {
          id: 'concept-start',
          subjectId: 'subject-core',
          cardRef: 'card-concept',
          actionRef: 'action-concept',
          orderHint: 1,
        },
      ],
      flow: [
        { id: 'flow-start-core', fromSubjectId: 'subject-start', toSubjectId: 'subject-core' },
        { id: 'flow-core-goal', fromSubjectId: 'subject-core', toSubjectId: 'subject-goal' },
      ],
      flowGroups: [],
    },
    data: {
      cards: [
        { id: 'card-start', title: '起点', summary: '从这里开始。' },
        { id: 'card-core', title: '载体', summary: '承载核心概念。' },
        { id: 'card-goal', title: '目标', summary: '到达目标。' },
        { id: 'card-concept', title: '核心概念', summary: '理解核心概念。' },
      ],
      resources: [
        { id: 'resource-concept', href: 'https://www.zhihu.com/question/1' },
      ],
      actions: [
        {
          id: 'action-concept',
          kind: 'open-resource',
          label: '查看内容',
          resourceId: 'resource-concept',
          target: 'blank',
        },
      ],
    },
    presentation: { layout: { direction: 'top-to-bottom' } },
  }
}

test('vendored validator and runtime compiler share one executable document contract', async () => {
  const {
    validateLearningPathDocument,
    compileValidatedLearningPathDocument,
    compileLearningPathRuntime,
  } = await loadExactVendorContract()

  const document = validDocument()
  const validation = validateLearningPathDocument(document)
  assert.equal(validation.ok, true)
  assert.doesNotThrow(() => compileLearningPathRuntime(compileValidatedLearningPathDocument(document)))

  const duplicate = structuredClone(document)
  duplicate.structure.subjects.push({ ...duplicate.structure.subjects[0] })
  const rejected = validateLearningPathDocument(duplicate)
  assert.equal(rejected.ok, false)
  assert.ok(rejected.issues.some((issue) => issue.code === 'duplicate_id'))
})

test('actual 3D compiler accepts consecutive parallel stages without duplicate physical roads or lost dependencies', async () => {
  const { compileValidatedLearningPathDocument, compileLearningPathRuntime } = await loadExactVendorContract()
  // Include the production failure shape first, then every four-stage width combination.
  const shapes = [[1, 2, 2, 1], ...Array.from({ length: 256 }, (_, code) =>
    Array.from({ length: 4 }, (_, stage) => Math.floor(code / 4 ** stage) % 4 + 1)),
  Array(16).fill(1), Array(6).fill(4)]
  for (const [caseIndex, widths] of shapes.entries()) {
    const stages = widths.map((width, s) => Array.from({ length: width }, (_, c) => ({
      title: `阶段 ${s} 载体 ${c}`, description: '有序并列阶段',
      // Regression shape also reaches the 64-concept limit and 12-concept carrier limit.
      concepts: Array.from({ length: caseIndex === 0 ? (s === 0 || s === widths.length - 1 ? 12 : 10) : 1 }, (_, i) => ({
        title: `概念 ${s}-${c}-${i}`, description: '范围完整的学习概念', hasDispute: false,
      })),
    })))
    const route = compileStagedPlan({ title: '并列编译回归', stages }, `runtime-shape-${caseIndex}`)
    const projected = projectRouteToDocument(route)
    assert.equal(projected.ok, true, `${widths}: ${projected.message}`)
    const document = projected.value.document, before = structuredClone(document)
    const source = compileValidatedLearningPathDocument(document)
    const peers = source.edges.filter(edge => edge.sourceKind === 'parallel-peer')
    const pairs = peers.map(edge => JSON.stringify([edge.fromNodeId, edge.toNodeId].sort()))
    assert.equal(new Set(pairs).size, pairs.length, `${widths}: duplicate physical sibling road`)
    assert.equal(peers.length, widths.reduce((n, width) => n + width - 1, 0), `${widths}: missing sibling road`)
    const semantic = source.edges.filter(edge => edge.sourceKind === 'subject-flow')
    const expectedEdges = route.carrierEdges.length + widths[0] + widths.at(-1)
    assert.equal(semantic.length, expectedEdges, `${widths}: lost stage dependencies`)
    assert.deepEqual(
      semantic.map(e => JSON.stringify([e.fromNodeId, e.toNodeId])).sort(),
      document.structure.flow.map(e => JSON.stringify([e.fromSubjectId, e.toSubjectId])).sort(),
    )
    assert.deepEqual(compileValidatedLearningPathDocument(document).edges, source.edges, 'physical edge IDs stay deterministic')
    assert.doesNotThrow(() => compileLearningPathRuntime(source), `actual 3D runtime: ${widths}`)
    assert.deepEqual(document, before, 'compiling must not rewrite the stored route')
  }
})
