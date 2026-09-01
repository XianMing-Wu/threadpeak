import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const contracts = await import('../src/index.ts')
const golden = JSON.parse(
  await readFile(new URL('../fixtures/transport-contracts.golden.json', import.meta.url), 'utf8'),
)

test('canonical PublicErrorSchema accepts golden fixture and rejects unknown keys', () => {
  assert.deepEqual(contracts.PublicErrorSchema.parse(golden.error), golden.error)
  assert.throws(() => contracts.PublicErrorSchema.parse({
    ...golden.error,
    extra: 'no',
  }))
  assert.throws(() => contracts.PublicErrorSchema.parse({
    ...golden.error,
    code: 'PROVIDER_TIMEOUT',
  }))
})

test('canonical StreamCursorSchema lowercases event ids and rejects negatives', () => {
  assert.deepEqual(contracts.StreamCursorSchema.parse({
    ...golden.cursor,
    lastEventId: golden.cursor.lastEventId.toUpperCase(),
  }), golden.cursor)
  assert.throws(() => contracts.StreamCursorSchema.parse({
    ...golden.cursor,
    sequence: -1,
  }))
})

test('stream event meta is a closed resource/sequence pair', () => {
  assert.deepEqual(contracts.StreamEventMetaSchema.parse(golden.streamMeta), golden.streamMeta)
  assert.throws(() => contracts.StreamEventMetaSchema.parse({
    ...golden.streamMeta,
    type: 'path.delta',
  }))
})
