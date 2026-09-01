import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const golden = JSON.parse(
  await readFile(new URL('../packages/contracts/fixtures/runtime-contracts.golden.json', import.meta.url), 'utf8'),
)
const nextContracts = await import('../packages/contracts/src/index.ts')
const inRepoOldHref = pathToFileURL(
  path.join(repoRoot, 'packages/contracts/compat/algorithm-shared-runtime-contracts.ts'),
).href
const siblingOldPath = path.resolve(repoRoot, '../算法/shared/runtime-contracts.ts')
const inRepoOldSource = await readFile(new URL(inRepoOldHref), 'utf8')
const inRepoOldContracts = await import(inRepoOldHref)

test('in-repo old path is a re-export, not a second schema copy', () => {
  assert.match(inRepoOldSource, /export \* from ['\"]\.\.\/src\/index\.ts['\"]/)
  assert.doesNotMatch(inRepoOldSource, /z\.object\(/)
  assert.match(inRepoOldSource, /删除条件/)
})

test('sibling algorithm path, when present, is also a re-export', async () => {
  const siblingSource = await readFile(siblingOldPath, 'utf8').catch(() => '')
  if (!siblingSource) return
  assert.match(siblingSource, /export \* from ['\"].*packages\/contracts\/src\/index\.ts['\"]/)
  assert.doesNotMatch(siblingSource, /z\.object\(/)
  const siblingContracts = await import(pathToFileURL(siblingOldPath).href)
  assert.deepEqual(
    nextContracts.UuidSchema.parse(golden.uuidUpper),
    siblingContracts.UuidSchema.parse(golden.uuidUpper),
  )
})

test('golden fixtures parse identically on both sides', () => {
  assert.deepEqual(
    nextContracts.UuidSchema.parse(golden.uuidUpper),
    inRepoOldContracts.UuidSchema.parse(golden.uuidUpper),
  )
  assert.deepEqual(
    nextContracts.EvidenceRecordSchema.parse(golden.evidence),
    inRepoOldContracts.EvidenceRecordSchema.parse(golden.evidence),
  )
  assert.deepEqual(
    nextContracts.SharedEventEnvelopeSchema.parse(golden.envelope),
    inRepoOldContracts.SharedEventEnvelopeSchema.parse(golden.envelope),
  )
})

test('unknown keys and versions fail on both sides', () => {
  const extraEvidence = { ...golden.evidence, extra: 'no' }
  const extraEnvelope = { ...golden.envelope, schemaVersion: 2 }
  assert.throws(() => nextContracts.EvidenceRecordSchema.parse(extraEvidence))
  assert.throws(() => inRepoOldContracts.EvidenceRecordSchema.parse(extraEvidence))
  assert.throws(() => nextContracts.SharedEventEnvelopeSchema.parse(extraEnvelope))
  assert.throws(() => inRepoOldContracts.SharedEventEnvelopeSchema.parse(extraEnvelope))
})
