import test from 'node:test'
import assert from 'node:assert/strict'
import {exampleLearning} from './example-learning.ts'
import {validateTree} from '../../packages/contracts/src/learning-v2.ts'

test('catalog examples use the learning contract with one source per paragraph and no real author identity',()=>{
  const notes=[{title:'向量空间',paragraphs:['向量可相加。','基张成整个空间。']},{title:'坐标',paragraphs:['坐标依赖基。']}]
  const state=exampleLearning({id:'example',routeId:'route-example',conceptId:'vectors',title:'向量空间',notes})
  assert.doesNotThrow(()=>validateTree(state.nodes))
  assert.equal(state.nodes.length,6)
  for(const p of state.conversations[0].messages[0].paragraphs){assert.deepEqual(p.parents,p.sources);assert.equal(p.basisId,p.parents[0])}
  assert.deepEqual(state.articles.map(a=>a.summary),notes.map(n=>n.paragraphs.join('\n\n')))
  assert.ok(state.articles.every(a=>a.authorId===null&&!a.url&&!a.avatar))
  assert.deepEqual(notes[0].paragraphs,['向量可相加。','基张成整个空间。'])
})
