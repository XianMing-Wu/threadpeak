import assert from 'node:assert/strict'
import test from 'node:test'
import { createRuntimeLease } from './runtime-lease.ts'

const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
test('navigation aborts a pending progress read before a renderer may mount', async () => {
  const lease = createRuntimeLease(), read = deferred(); let mounts = 0
  const work = (async () => { await read.promise; lease.signal.throwIfAborted(); mounts++ })()
  lease.dispose(); read.resolve(null)
  await assert.rejects(work, { name: 'AbortError' }); assert.equal(mounts, 0)
})
test('a late mount is disposed once without disposing the next attempt', async () => {
  const old = createRuntimeLease(), next = createRuntimeLease(), mount = deferred(); let oldDisposals = 0, nextDisposals = 0
  const work = mount.promise.then(instance => old.attach(instance))
  old.dispose(); next.attach({dispose(){nextDisposals++}})
  mount.resolve({dispose(){oldDisposals++}})
  assert.equal(await work, false); old.dispose()
  assert.equal(oldDisposals, 1); assert.equal(nextDisposals, 0)
  assert.ok(next.current); next.dispose(); next.dispose(); assert.equal(nextDisposals, 1)
})
