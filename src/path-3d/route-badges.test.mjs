import test from 'node:test'
import assert from 'node:assert/strict'
import { routeBadgeEntries } from './route-badges.ts'

test('every generated node gets a stable semantic badge, with multiple goals and arbitrary IDs', () => {
  const structure={entrySubjectId:'entry/α',goalSubjectIds:['goal-1','goal-2'],subjects:[{id:'entry/α'},{id:'s-1'},{id:'goal-1'},{id:'goal-2'}],concepts:[{id:'c-1'},{id:'c-2'}]}
  assert.deepEqual(Object.fromEntries(routeBadgeEntries(structure)),{'entry/α':'start','s-1':'carrier','goal-1':'goal','goal-2':'goal','c-1':'concept','c-2':'concept'})
  assert.equal(JSON.stringify(routeBadgeEntries(structuredClone(structure))),JSON.stringify(routeBadgeEntries(structure)))
})
