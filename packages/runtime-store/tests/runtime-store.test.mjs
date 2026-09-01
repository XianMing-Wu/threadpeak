import assert from 'node:assert/strict'
import test from 'node:test'

const storeApi = await import('../src/index.ts')

const first = {
  eventId: '11111111-1111-4111-8111-111111111111',
  resourceId: 'conversation-1',
  sequence: 0,
  traceId: 'trace-1',
}

const second = {
  eventId: '22222222-2222-4222-8222-222222222222',
  resourceId: 'conversation-1',
  sequence: 1,
  traceId: 'trace-1',
}

test('runtime store snapshots stay immutable and selectors see committed view only', () => {
  const store = storeApi.createRuntimeStore({ count: 0 })
  const firstSnapshot = store.getSnapshot()
  store.hydrateFromGet({ count: 1 })
  const secondSnapshot = store.getSnapshot()
  assert.notEqual(firstSnapshot, secondSnapshot)
  assert.equal(firstSnapshot.view.count, 0)
  assert.equal(secondSnapshot.view.count, 1)
  store.setInflight('conversation-1', 'streaming')
  assert.equal(store.getSnapshot().inflight['conversation-1'], 'streaming')
  assert.equal(secondSnapshot.inflight['conversation-1'], undefined)
})

test('duplicate and late events do not change the snapshot; gaps fail closed', () => {
  const store = storeApi.createRuntimeStore({ items: [] })
  const project = (view, event) => ({ items: [...view.items, event.eventId] })
  assert.equal(store.applyCommittedEvent(first, project), 'apply')
  const afterFirst = store.getSnapshot()
  assert.equal(store.applyCommittedEvent(first, project), 'duplicate')
  assert.equal(store.getSnapshot(), afterFirst)
  assert.equal(store.applyCommittedEvent({ ...first, eventId: '33333333-3333-4333-8333-333333333333', sequence: 0 }, project), 'late')
  assert.equal(store.getSnapshot(), afterFirst)
  assert.equal(store.applyCommittedEvent({ ...second, sequence: 3 }, project), 'gap')
  assert.equal(store.getSnapshot().streamHealth, 'gap')
  assert.equal(store.getSnapshot().view.items.length, 1)
  assert.equal(store.applyCommittedEvent(second, project), 'apply')
  assert.deepEqual(store.getSnapshot().view.items, [first.eventId, second.eventId])
})

test('teardown drops listeners and ignores later writes', () => {
  const store = storeApi.createRuntimeStore({ count: 0 })
  let ticks = 0
  const unsubscribe = store.subscribe(() => {
    ticks += 1
  })
  store.hydrateFromGet({ count: 1 })
  store.teardown()
  unsubscribe()
  store.hydrateFromGet({ count: 2 })
  store.setInflight('conversation-1', 'loading')
  assert.equal(store.getSnapshot().view.count, 1)
  assert.equal(ticks, 1)
})
