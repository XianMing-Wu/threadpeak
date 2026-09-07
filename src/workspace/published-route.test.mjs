import test from 'node:test'
import assert from 'node:assert/strict'
import { mineRouteFromValidatedDocument } from './published-route.ts'
test('distinct persisted routes never share a list key even with a legacy duplicate document id',()=>{
  const document={protocol:'learning-path',version:'1.0',id:'legacy',metadata:{title:'Route'}}
  const a=mineRouteFromValidatedDocument('goal','chat-a',document,1,'resource-a')
  const b=mineRouteFromValidatedDocument('goal','chat-b',structuredClone(document),2,'resource-b')
  assert.notEqual(a.id,b.id);assert.equal(a.document.id,b.document.id)
  assert.equal(a.document,document)
})
