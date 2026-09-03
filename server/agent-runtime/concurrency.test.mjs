import assert from 'node:assert/strict'
import test from 'node:test'
import { ZHIHU_CONCURRENCY, mapWithConcurrency } from './concurrency.ts'

test('mapWithConcurrency never exceeds the cap and keeps order', async () => {
  let inFlight = 0
  let maxInFlight = 0
  const values = await mapWithConcurrency([1, 2, 3, 4], ZHIHU_CONCURRENCY, async (item) => {
    inFlight += 1
    maxInFlight = Math.max(maxInFlight, inFlight)
    await new Promise((resolve) => setTimeout(resolve, 15))
    inFlight -= 1
    return item * 10
  })
  assert.equal(ZHIHU_CONCURRENCY, 2)
  assert.equal(maxInFlight, 2)
  assert.deepEqual(values, [10, 20, 30, 40])
})

test('mapWithConcurrency returns empty for no items', async () => {
  const values = await mapWithConcurrency([], 2, async (item) => item)
  assert.deepEqual(values, [])
})
