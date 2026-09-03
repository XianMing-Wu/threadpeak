import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createPathProgressStorage,
  pathProgressKey,
  resetPathProgressStorageForTests,
} from './path-progress-storage.ts'

test('progressKey is stable per document and has two namespace pairs', () => {
  const key = pathProgressKey('threadpeak-linear-algebra-v1')
  const parts = key.split(':')
  assert.equal(parts.length, 4)
  assert.equal(parts.length % 2, 0)
  assert.equal(key, pathProgressKey('threadpeak-linear-algebra-v1'))
  assert.notEqual(key, pathProgressKey('threadpeak-critical-thinking-v1'))
})

test('storage returns renderer blobs opaquely and isolates documents', async () => {
  resetPathProgressStorageForTests()
  const cache = new Map()
  const storage = createPathProgressStorage({
    read: (key) => cache.get(key) ?? null,
    write: (key, value) => { cache.set(key, value) },
  })
  const signal = new AbortController().signal
  const first = pathProgressKey('doc-a')
  const second = pathProgressKey('doc-b')
  const blob = '{"renderer":"owned","not-a-product-field":true}'
  await storage.write({ key: first, value: blob }, { signal })
  assert.equal(await storage.read({ key: first }, { signal }), blob)
  assert.equal(await storage.read({ key: second }, { signal }), null)
  assert.equal(JSON.parse(blob).renderer, 'owned')
})

test('a later storage handle can restore the same document blob from the cache', async () => {
  resetPathProgressStorageForTests()
  const cache = new Map()
  const ports = {
    read: (key) => cache.get(key) ?? null,
    write: (key, value) => { cache.set(key, value) },
  }
  const signal = new AbortController().signal
  const key = pathProgressKey('doc-restore')
  await createPathProgressStorage(ports).write({ key, value: 'opaque-progress' }, { signal })
  resetPathProgressStorageForTests()
  const restored = await createPathProgressStorage(ports).read({ key }, { signal })
  assert.equal(restored, 'opaque-progress')
})
