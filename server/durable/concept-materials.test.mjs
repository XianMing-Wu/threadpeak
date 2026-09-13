import test from 'node:test'
import assert from 'node:assert/strict'
import {applyConceptMaterials,ensureConceptMaterials} from './concept-materials.ts'
import {openDatabase,migrate} from './database.ts'
import {DurableStore} from './store.ts'
import {replyInput} from './flows.ts'
import {LearningSchema,validateTree} from '@threadpeak/contracts/learning-v2'
const catalog=Array.from({length:23},(_,i)=>({id:`a${i}`,title:`文章${i}`,summary:`真实正文${i}`,author:'作者',authorId:'author',likes:1,topic:'收藏夹',sourceKind:'collection',materialId:'folder-import'}))
const state=()=>({version:2,routeId:'path',conceptId:'c',title:'概念',description:'说明',hasDispute:false,initialized:true,phase:'ready',articles:structuredClone(catalog),nodes:[{id:'root',type:'root',title:'概念',text:'',sources:catalog.map(a=>a.id),parents:[]},...catalog.map(a=>({id:a.id,type:'article',title:a.title,text:a.summary,sources:[a.id],parents:['root']}))],active:'chat',conversations:[{id:'chat',title:'概念',date:'today',messages:[]}]})
test('23 imported articles become the selected concept set, never all imported defaults',()=>{
 const data=applyConceptMaterials(state(),catalog,['a12','a3','a7'])
 assert.deepEqual(data.articles.map(a=>a.id),['a12','a3','a7'])
 assert.deepEqual(replyInput(data,'问题',[],'chat').allowedCards.map(c=>c.id),['a12','a3','a7'])
 validateTree(data.nodes);LearningSchema.parse(data)
 assert.deepEqual(applyConceptMaterials(data,catalog,['a12','a3','a7']),data)
 assert.throws(()=>applyConceptMaterials(state(),catalog,['forged']))
})
test('legacy repair preserves historical citations, edited cards and descendants without defaulting to them',()=>{
 const data=state();data.nodes.find(n=>n.id==='a1').edited=true
 data.nodes.push({id:'answer',type:'answer',title:'解释',text:'正文',sources:['a2'],parents:['a2'],basisId:'a2'})
 data.conversations[0].messages.push({id:'old',role:'assistant',paragraphs:[{id:'archived',title:'说明',text:'历史正文',sources:['a4'],parents:['a4'],basisId:'a4'}]})
 applyConceptMaterials(data,catalog,['a3'])
 assert.deepEqual(data.articles.map(a=>a.id),['a3','a1','a2','a4'])
 assert.deepEqual(data.articles.filter(a=>!a.retainedForHistory).map(a=>a.id),['a3'])
 assert.deepEqual(replyInput(data,'新问题',[],'chat').cards.map(c=>c.id),['a3'])
 assert.deepEqual(replyInput(data,'回看历史',['a2'],'chat').cards.map(c=>c.id),['a2'])
 assert.equal(data.nodes.find(n=>n.id==='answer').parents[0],'a2');validateTree(data.nodes)
})
test('empty relevant collection stays honest and uploads remain usable',()=>{
 const data=state(),file={...catalog[0],id:'file',sourceKind:'upload'};data.articles.push(file)
 applyConceptMaterials(data,catalog,[])
 assert.deepEqual(data.articles.map(a=>a.id),['file'])
 assert.deepEqual(replyInput(data,'问题',[],'chat').cards.map(c=>c.id),['file'])
})
test('cancelled legacy material repair does not break reads after switching conversations',async()=>{
 const db=await openDatabase();await migrate(db)
 try{
  const store=new DurableStore(db),owner='repair-owner'
  const resource=await store.create(owner,'learning','legacy',state())
  assert.equal(await ensureConceptMaterials(store,owner,resource.id),true)
  const key=`concept-materials:1:${resource.id}`,original=await store.existingCommand(owner,key)
  await store.cancel(owner,resource.id)
  await store.edit(owner,resource.id,undefined,r=>({...r.body,active:'new-chat',conversations:[...r.body.conversations,{id:'new-chat',title:'新对话',date:'today',messages:[]}]}))
  assert.equal(await ensureConceptMaterials(store,owner,resource.id),false)
  const preserved=await store.existingCommand(owner,key)
  assert.equal(preserved.id,original.id);assert.equal(preserved.status,'cancelled')
  assert.equal(preserved.input.conversationId,'chat')
  assert.equal((await store.snapshot(owner,resource.id)).data.active,'new-chat')
 }finally{await db.close()}
})
