import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const testDirectory = path.dirname(fileURLToPath(import.meta.url))
const frontendRoot = path.resolve(testDirectory, '..')
const vendorRoot = path.resolve(frontendRoot, 'src/vendor/learning-path-3d')

async function loadExactVendorContract() {
  const bundlePath = path.join(vendorRoot, 'index.js')
  let source = await readFile(bundlePath, 'utf8')
  const dependencyMatch = source.match(/from "(\.\/overpassSpec-[^"]+\.js)";/)
  assert.ok(dependencyMatch, 'vendor bundle dependency must remain discoverable')
  const dependencyUrl = pathToFileURL(path.resolve(vendorRoot, dependencyMatch[1])).href
  source = source.replace(dependencyMatch[0], `from "${dependencyUrl}";`)

  const publicExport = 'export { Eo as mountLearningPath };'
  assert.ok(source.includes(publicExport), 'vendor public export shape changed; inspect the real bundle')
  source = source.replace(
    publicExport,
    'export { h as validateLearningPathDocument, ve as compileLearningPathDocument, Ha as compileLearningPathRuntime };',
  )
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
    compileLearningPathDocument,
    compileLearningPathRuntime,
  } = await loadExactVendorContract()

  const document = validDocument()
  const validation = validateLearningPathDocument(document)
  assert.equal(validation.ok, true)
  assert.doesNotThrow(() => compileLearningPathRuntime(compileLearningPathDocument(document)))

  const duplicate = structuredClone(document)
  duplicate.structure.subjects.push({ ...duplicate.structure.subjects[0] })
  const rejected = validateLearningPathDocument(duplicate)
  assert.equal(rejected.ok, false)
  assert.ok(rejected.issues.some((issue) => issue.code === 'duplicate_id'))
})
