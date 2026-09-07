import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { checkArchitecture } from '../scripts/check-architecture.mjs'

test('import graph stays inside this repository and never uses sibling paths', async () => {
  const summary = await checkArchitecture()
  assert.ok(summary.files > 20, 'architecture scan must cover runtime and test files')
  assert.ok(summary.edges > 10, 'architecture scan must resolve local import edges')
})

test('vendored runtime assets match the complete recorded build manifest', async () => {
  const source = await readFile(new URL('../vendor/SOURCE.md', import.meta.url), 'utf8')
  const root = new URL('../src/vendor/learning-path-3d/', import.meta.url)
  const manifest = JSON.parse(await readFile(new URL('../vendor/learning-path-3d-manifest.json', import.meta.url), 'utf8'))
  const files = await readdir(root, { recursive: true, withFileTypes: true })
  const actual = files.filter(file => file.isFile()).map(file =>
    path.relative(fileURLToPath(root), path.join(file.parentPath, file.name)).split(path.sep).join('/'),
  )
  assert.deepEqual(actual.sort(), Object.keys(manifest).sort(), 'no missing or stale vendor chunks')
  for (const [name, expected] of Object.entries(manifest)) {
    const bytes = await readFile(new URL(name, root))
    assert.equal(bytes.length, expected.bytes, `${name}: byte length`)
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected.sha256, `${name}: digest`)
  }
  assert.match(source, /learning-path-3d-manifest\.json/)
  assert.match(source, /禁止再通过/)
})
