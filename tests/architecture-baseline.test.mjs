import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { checkArchitecture } from '../scripts/check-architecture.mjs'

test('import graph stays inside this repository and never uses sibling paths', async () => {
  const summary = await checkArchitecture()
  assert.ok(summary.files > 20, 'architecture scan must cover runtime and test files')
  assert.ok(summary.edges > 10, 'architecture scan must resolve local import edges')
})

test('vendored runtime assets keep documented digests', async () => {
  const source = await readFile(new URL('../vendor/SOURCE.md', import.meta.url), 'utf8')
  for (const digest of [
    'ea4dc55c621c7f484b7e25351a685409d1fb92ddc0f486fcc5a4b64517d1c794',
    'bb4edffa2481be66bd11b9e8b7091243bd5904147388c058115463558ffffdc0',
    '004e767bcf5af1722acce85bcbe4ed194a2d1ba01b5751b27c492be6a0d7fd45',
  ]) {
    assert.match(source, new RegExp(digest))
  }
  assert.match(source, /禁止再通过/)
})
