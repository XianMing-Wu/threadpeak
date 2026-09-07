import assert from 'node:assert/strict'
import test from 'node:test'
import { hostDocumentChanged } from './host-document-persistence.ts'

test('repeated cache round trips do not create a render/write feedback loop', () => {
  let stored = JSON.stringify({id:'route',structure:{flow:[{from:'a',to:'b'}]}}),writes=0
  const rendered = JSON.parse(stored)
  for(let i=0;i<100;i++)if(hostDocumentChanged(JSON.parse(stored),rendered)){stored=JSON.stringify(rendered);writes++}
  assert.equal(writes,0)
  const edited=structuredClone(rendered);edited.structure.flow[0].to='c'
  assert.equal(hostDocumentChanged(JSON.parse(stored),edited),true)
  stored=JSON.stringify(edited);assert.equal(hostDocumentChanged(JSON.parse(stored),edited),false)
})
