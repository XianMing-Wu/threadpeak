import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const contracts = await import('../src/index.ts')
const golden = JSON.parse(
  await readFile(new URL('../fixtures/runtime-contracts.golden.json', import.meta.url), 'utf8'),
)

test('canonical UuidSchema lowercases and rejects non-uuid', () => {
  assert.equal(contracts.UuidSchema.parse(golden.uuidUpper), golden.uuidLower)
  assert.equal(contracts.UuidSchema.parse(golden.uuidLower), golden.uuidLower)
  assert.throws(() => contracts.UuidSchema.parse('not-a-uuid'))
  assert.throws(() => contracts.UuidSchema.parse(''))
})

test('canonical EvidenceRecordSchema accepts golden fixture and rejects unknown keys', () => {
  assert.deepEqual(contracts.EvidenceRecordSchema.parse(golden.evidence), golden.evidence)
  assert.throws(() => contracts.EvidenceRecordSchema.parse({
    ...golden.evidence,
    extra: 'no',
  }))
  assert.throws(() => contracts.EvidenceRecordSchema.parse({
    ...golden.evidence,
    provider: 'openai',
  }))
})

test('canonical SharedEventEnvelopeSchema accepts v1 and rejects unknown version', () => {
  assert.deepEqual(contracts.SharedEventEnvelopeSchema.parse(golden.envelope), golden.envelope)
  assert.throws(() => contracts.SharedEventEnvelopeSchema.parse({
    ...golden.envelope,
    schemaVersion: 2,
  }))
  assert.throws(() => contracts.SharedEventEnvelopeSchema.parse({
    ...golden.envelope,
    extra: true,
  }))
})
