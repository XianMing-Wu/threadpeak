import test from 'node:test'
import assert from 'node:assert/strict'
import {openDatabase,migrate} from './database.ts'
import {DurableStore} from './store.ts'
import {TaskContext} from './worker.ts'
import {ProductTools} from './tools.ts'
import {validateAnswerBasis,ANSWER_BASIS_LIMIT} from '../knowledge/answer-basis.ts'
import {readCardScope} from '../knowledge/card-tools.ts'
import {recoverStructuredValue} from './output-recovery.ts'
import {validateComposition} from '../knowledge/answer-composition.ts'

const materials=Array.from({length:23},(_,i)=>({id:`owned-${i}`,title:`资料 ${i}`,content:`第 ${i} 份材料有自己的完整依据。`}))
test('basis planning reads all candidates but freezes at most four before writing; associations cannot move parents',async t=>{
 const db=await openDatabase();await migrate(db);t.after(()=>db.close())
 const store=new DurableStore(db),r=await store.create('owner','test','basis',{})
 await store.enqueue('owner',r.id,'test','basis',{depth:'fast'})
 const job=await store.claim(),ctx=new TaskContext(store,job,new AbortController().signal),calls=[]
 const tools=new ProductTools({complete:async call=>{
  const input=JSON.parse(call.messages[1].content);calls.push(input);assert.equal(call.thinkingDepth,'fast')
  if(input.candidate_card_scope){
   assert.equal(input.candidate_card_scope.cards.length,23)
   assert.equal((await store.snapshot('owner',r.id)).job.activities.find(a=>a.id==='answer:basis').status,'running')
   return {kind:'completed',text:JSON.stringify({selections:[20,3,17,9].map(n=>({ref:`C${n}`,reason:'该部分必要依据'}))})}
  }
  if(input.citationCatalog)return {kind:'completed',text:JSON.stringify({placements:input.answerSections.map((s,i)=>({section:s.ref,after:`C${4-i}`,evidenceRefs:['E2']}))})}
  assert.equal(input.read_card_scope.cards.length,4)
  assert.deepEqual(input.read_card_scope.cards.map(c=>c.title),[19,2,16,8].map(i=>materials[i].title))
  assert.deepEqual(input.basisPlan.map(p=>p.ref),['C1','C2','C3','C4'])
  return {kind:'completed',text:JSON.stringify({sections:input.read_card_scope.cards.map(c=>({after:c.ref,title:c.title,blocks:[{kind:'text',text:c.content}]}))})}
 }},{})
 const input={allowedCards:materials,currentQuestion:'比较选定资料的各自依据。'}
 const result=await tools.answerCards(ctx,input)
 assert.deepEqual(result.paragraphs.map(p=>p.basisId),[19,2,16,8].map(i=>materials[i].id))
 assert.equal(calls.length,3);assert.deepEqual((await store.snapshot('owner',r.id)).data,{})
 await tools.answerCards(ctx,input);assert.equal(calls.length,3)
 await ctx.flush();assert.equal((await store.snapshot('owner',r.id)).job.activities.find(a=>a.id==='answer:basis').status,'done')
 await assert.rejects(store.snapshot('foreign',r.id),e=>e.status===404)
})
test('malformed, duplicate and oversized basis selections recover only from the current scope at the fixed limit',()=>{
 const input={candidate_card_scope:readCardScope(materials).view,currentQuestion:'第十九份材料'}
 const raw=JSON.stringify({selections:[{ref:'C20',reason:'完整理由'},...Array.from({length:30},(_,i)=>({ref:`C${i}`,reason:'理由'}))]})
 for(const value of ['',raw,'{"selections":[{"ref":"C999"}]}',...Array.from({length:raw.length},(_,i)=>raw.slice(0,i))]){
  const result=validateAnswerBasis(recoverStructuredValue('L-answer:basis-v1',value,input),input)
  assert.ok(result.selections.length<=ANSWER_BASIS_LIMIT);assert.ok(result.selections.length>0)
  assert.ok(result.selections.every(s=>input.candidate_card_scope.cards.some(c=>c.ref===s.ref)))
 }
 assert.throws(()=>validateAnswerBasis({selections:Array.from({length:5},(_,i)=>({ref:`C${i+1}`,reason:'理由'}))},input))
})
test('every truncation of typed blocks remains readable and preserves all selected parents',()=>{
 const scope=readCardScope(materials.slice(0,4)),input={read_card_scope:scope.view,basisPlan:scope.view.cards.map(c=>({ref:c.ref,focus:'当前依据'})),mode:'first_learning',answerBounds:{maxCards:8}}
 const raw=JSON.stringify({sections:scope.view.cards.map(c=>({after:c.ref,title:c.title,blocks:[{kind:'text',text:'假设两项输入如下。'},{kind:'calculation',operation:'sum',operands:['0.1','0.2']}]}))})
 for(let i=0;i<=raw.length;i++){
  const answer=validateComposition(recoverStructuredValue('L-answer:compose-v4',raw.slice(0,i),input),scope.view,8,true)
  assert.deepEqual(new Set(answer.sections.map(s=>s.after)),new Set(scope.view.cards.map(c=>c.ref)))
  assert.ok(answer.sections.every(s=>s.text.trim()))
 }
})
