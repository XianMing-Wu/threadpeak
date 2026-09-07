import assert from 'node:assert/strict'
import test from 'node:test'
import {readCardScope,resolveCardOperations} from './card-tools.ts'
import {replyInput} from '../durable/flows.ts'
const materials=[{id:'article-long-uuid',title:'文章',content:'全文 A'},{id:'answer-long-uuid',title:'上次回答',content:'全文 B'}]
const append=(after,title='回答',quote=after==='C2'?'全文 B':'全文 A')=>({tool:'append_cards',after,evidence:[quote],title,text:'一段仅依据父卡的内容'})
test('card tool resolves multi-selection in output order with exactly one server-owned parent',()=>{
  const scope=readCardScope(materials),result=resolveCardOperations(scope,{operations:[append('C2'),append('C1'),append('C2')]})
  assert.deepEqual(result.map(p=>p.basisId),['answer-long-uuid','article-long-uuid','answer-long-uuid'])
  assert.deepEqual(scope.view.cards.map(c=>c.content),['全文 A','全文 B'])
  assert.equal(JSON.stringify(scope.view).includes('long-uuid'),false)
})
test('card tool rejects out-of-scope, multiple parents, invented source IDs and unknown tools',()=>{
  const scope=readCardScope(materials)
  for(const operation of [append('C3'),append('C0'),append('C01'),append('other-owner'),{...append('C1'),after:['C1','C2']},{...append('C1'),parents:['C2']},{...append('C1'),tool:'delete_cards'},{...append('C1'),cards:[{title:'a',text:'b',sourceId:'invented'}]}])assert.throws(()=>resolveCardOperations(scope,{operations:[operation]}))
  assert.throws(()=>resolveCardOperations(scope,{operations:[]}))
})
test('no selection scopes all articles; selected custom and answer cards stay scoped and frozen',()=>{
  const state={title:'概念',conceptId:'c',description:'描述',articles:[{id:'a'},{id:'b'}],nodes:[{id:'a',title:'a',text:'A'},{id:'b',title:'b',text:'B'},{id:'custom',title:'我的卡',text:'C'}],conversations:[{id:'current',messages:[]},{id:'old',messages:[{id:'old-msg',role:'user',text:'不应进入当前上下文'}]}]}
  const all=replyInput(state,'比较',[],'current');assert.deepEqual(all.allowedCards.map(c=>c.id),['a','b'])
  const scope=readCardScope(replyInput(state,'说明',['custom'],'current').allowedCards)
  state.nodes[2].text='稍后编辑';assert.equal(scope.view.cards[0].content,'C')
  assert.deepEqual(all.conversation,[])
  assert.equal(resolveCardOperations(scope,{operations:[append('C1','回答','C')]})[0].basisId,'custom')
})

test('each paragraph owns its evidence; batching mixed article paragraphs under C1 is rejected',()=>{
  const scope=readCardScope([{id:'school',title:'课本分类',content:'课本包括代数和几何。'},{id:'history',title:'代数词源',content:'代数源于 al-jabr，含义是还原。'},{id:'equations',title:'代数内容',content:'初等代数的中心内容是解方程。'}])
  const history=append('C2','词源','代数源于 al-jabr，含义是还原。'),equations=append('C3','内容','初等代数的中心内容是解方程。')
  assert.throws(()=>resolveCardOperations(scope,{operations:[{...history,after:'C1',cards:[history,equations]}]}))
  assert.throws(()=>resolveCardOperations(scope,{operations:[{...history,after:'C1'}]}),/C1 的 evidence 不在该卡片材料中/)
  assert.deepEqual(resolveCardOperations(scope,{operations:[history,equations]}).map(p=>p.basisId),['history','equations'])
  assert.throws(()=>resolveCardOperations(scope,{operations:[append('C2','内容','直答中独有的补充')]}),/evidence/)
})
test('legitimate repeated citations, empty custom cards, whitespace and Unicode equivalence work',()=>{
  const scope=readCardScope([{id:'a',title:'Cafe\u0301',content:'等式两边\n同时加上 3。'},{id:'root',title:'代数基础',content:''}])
  const operations=[append('C1','解释','等式两边同时加上3。'),append('C1','例子','Café'),append('C2','根卡','代数基础')]
  assert.deepEqual(resolveCardOperations(scope,{operations}).map(p=>p.basisId),['a','a','root'])
  assert.throws(()=>resolveCardOperations(scope,{operations:[append('C1','不允许改写引文','等式两边同时减去3。')]}),/evidence/)
  assert.throws(()=>resolveCardOperations(scope,{operations:[append('C1','不能拼接标题和正文','Café等式两边')]}),/evidence/)
})

test('first-learning material review covers the full scope without a citation quota',()=>{
  const scope=readCardScope(materials),operations=[append('C2')]
  assert.throws(()=>resolveCardOperations(scope,{operations},true),/sourceReview/)
  const sourceReview=[{ref:'C1',contribution:'与另一篇相同的背景，本次不采用'},{ref:'C2',contribution:'用于回答本次问题'}]
  assert.equal(resolveCardOperations(scope,{sourceReview,operations},true)[0].basisId,'answer-long-uuid')
  for(const bad of [sourceReview.slice(1),[sourceReview[0],sourceReview[0]],sourceReview.map(r=>({...r,ref:'C3'}))])assert.throws(()=>resolveCardOperations(scope,{sourceReview:bad,operations},true))
})
