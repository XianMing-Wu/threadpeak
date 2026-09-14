import test from 'node:test'
import assert from 'node:assert/strict'
import {searchInPairs,querySchema} from '../knowledge/search-planning.ts'
import {openDatabase,migrate} from './database.ts'
import {DurableStore} from './store.ts'
import {TaskContext,DurableWorker} from './worker.ts'
import {ProductTools} from './tools.ts'
import {createFlows,replyInput} from './flows.ts'
import {pathGoalContext} from './learning-goal.ts'
import {validateTree,LearningSchema} from '@threadpeak/contracts/learning-v2'
import {readAuthorNetwork} from './authors-network.ts'
import {paragraphsMarkdown} from '@threadpeak/contracts/learning-markdown'
import {placeAnswer} from '../../tests/fixtures/card-answer.mjs'
import {validateComposition} from '../knowledge/answer-composition.ts'

async function fixture(t){const db=await openDatabase();await migrate(db);t.after(()=>db.close());return new DurableStore(db)}
const wait=()=>new Promise(r=>setImmediate(r))
const state=()=>({version:2,routeId:'r',conceptId:'c',title:'当前概念',description:'这节只解释目标需要的局部操作。',hasDispute:false,initialized:true,phase:'ready',active:'chat',conversations:[{id:'chat',title:'学习',date:'2026-09-09',messages:[]}],articles:[{id:'host',title:'当前材料',summary:'完整总结',author:'原作者',authorId:'old-author',likes:null,topic:'学习'}],nodes:[{id:'root',type:'root',title:'概念',text:'',parents:[],sources:['host']},{id:'host',type:'article',title:'当前材料',text:'完整总结',parents:['root'],sources:['host']}]})
const source=(id,authorId)=>({evidenceId:id,title:`材料${id}`,summary:`真实边界替身的完整内容${id}`,authorId,authorName:`作者${authorId}`,url:`https://zhuanlan.zhihu.com/p/${id}`})

test('lesson format rejects internal source prose, normalizes duplicate H2 and preserves heading examples inside code',()=>{
 const view={cards:[{ref:'C1',title:'材料',content:'操作与检验'}]},answer=text=>({sections:[{after:'C1',title:'本节要点',text}]})
 assert.throws(()=>validateComposition(answer('C1中提到应该这样做。'),view,8,false),/内部来源编号/)
 assert.equal(validateComposition(answer('## 重复的标题\n正文'),view,8,false).sections[0].text,'### 重复的标题\n正文')
 assert.doesNotThrow(()=>validateComposition(answer('下面是Markdown示例：\n```markdown\n## 示例标题\n```'),view,8,false))
})

test('2–6 search queries are individual calls, a slow pair blocks the next pair, and failure never dispatches later pairs',async()=>{
 for(const size of [2,3,4,5,6]){
  const starts=[],releases=[];let active=0,max=0
  const run=searchInPairs(Array.from({length:size},(_,i)=>`问题${i}`),(q,i)=>{starts.push(i);active++;max=Math.max(max,active);return new Promise(resolve=>releases[i]=()=>{active--;resolve(q)})})
  await wait();assert.deepEqual(starts,[0,1]);releases[1]();await wait();assert.deepEqual(starts,[0,1]);releases[0]()
  for(let i=2;i<size;i+=2){await wait();assert.deepEqual(starts,Array.from({length:Math.min(i+2,size)},(_,j)=>j));releases[i]();releases[i+1]?.()}
  assert.deepEqual(await run,Array.from({length:size},(_,i)=>`问题${i}`));assert.equal(max,2)
 }
 const sent=[];await assert.rejects(searchInPairs(['一','二','三'],async(q,i)=>{sent.push(i);if(i===0)throw Error('upstream');return q}),/upstream/);assert.deepEqual(sent,[0,1])
 assert.equal(querySchema(6).safeParse({queries:['相同','相同']}).success,false)
 assert.equal(querySchema(4).safeParse({queries:['一问','二问','三问','四问','五问']}).success,false)
})

test('owned route context preserves concept summary, material alignment and previous/next context without claiming mastery',()=>{
 const goal=pathGoalContext({goal:'只学资料中的数学',conversation:[],route:{title:'数学路线',carriers:[{id:'carrier',title:'线性代数',description:'只补公式使用的运算'}],concepts:[{id:'before',title:'向量',detailedDescription:'表示一列数'},{id:'c',carrierId:'carrier',title:'点积',detailedDescription:'按位相乘求和'},{id:'after',title:'注意力分数',detailedDescription:'用点积计算分数'}],conceptEdges:[{fromConceptId:'before',toConceptId:'c'},{fromConceptId:'c',toConceptId:'after'}]}},'c')
 assert.equal(goal.rawGoal,'只学资料中的数学');assert.equal(goal.routeContext.carrier.description,'只补公式使用的运算')
 assert.deepEqual(goal.routeContext.previous,[{title:'向量',summary:'表示一列数'}]);assert.deepEqual(goal.routeContext.next,[{title:'注意力分数',summary:'用点积计算分数'}]);assert.equal(goal.userStatements.length,0)
})

test('six-query first lesson persists ordered H2 Markdown with a real source per block and no direct stage',async t=>{
 const store=await fixture(t),initial=state();Object.assign(initial,{initialized:false,articles:[],nodes:[],phase:'searching',learningSummary:{focus:'用同一例子解释目标关系',boundary:'只补当前所需定义，不讲后续整课',routeConnection:'此处学习运算，为后项的关系解释做准备',materialConnection:'对应当前用户资料中的运算片段'}})
 const resource=await store.create('owner','learning','six',initial),queries=Array.from({length:6},(_,i)=>`本节问题${i}`),sent=[],seen=[]
 const llm={complete:async input=>{const c=JSON.parse(input.messages[1].content);seen.push(c);let out
  if(c.materials)out={queries}
  else if(c.candidates)out={evidenceIds:['2','0']}
  else if(c.candidate_card_scope)out={selections:c.candidate_card_scope.cards.map(c=>({ref:c.ref,reason:'互补依据'}))}
  else if(c.citationCatalog)out=placeAnswer(c)
  else {assert.equal(c.mode,'first_learning');assert.equal(c.directAnswers,undefined);out={sourceReview:c.read_card_scope.cards.map(c=>({ref:c.ref,contribution:'互补依据'})),sections:[{after:'C2',title:'从操作开始',text:'先完成这步操作。'},{after:'C1',title:'用操作解释关系',text:'沿用上一步的结果解释关系。'}]}}
  return {kind:'completed',text:JSON.stringify(out)}
 }}
 const zhihu={search:async q=>{sent.push(q);return {kind:'hits',items:[source(String(queries.indexOf(q)),`author${queries.indexOf(q)}`)]}},direct:()=>assert.fail('retired direct called')}
 await store.enqueue('owner',resource.id,'learning.enter','enter',{conversationId:'chat',depth:'fast'});const worker=new DurableWorker(store,createFlows(new ProductTools(llm,zhihu)),1,()=>{});await worker.execute(await store.claim())
 const result=await store.snapshot('owner',resource.id);assert.equal(result.job.status,'completed');assert.deepEqual(sent,queries);LearningSchema.parse(result.data);validateTree(result.data.nodes)
 assert.equal((result.data.initialMarkdown.match(/^## /gm)??[]).length,2);assert.equal((result.data.initialMarkdown.match(/参考来源：/g)??[]).length,2)
 assert.match(result.data.initialMarkdown,/https:\/\/zhuanlan.zhihu.com\/p\/0/);assert.deepEqual(result.data.initialAnswer.map(p=>p.basisId),['0','2'])
 for(const input of seen.filter(c=>!c.citationCatalog))assert.deepEqual(input.concept.learningSummary,initial.learningSummary)
 const checkpoints=(await store.resource('owner',resource.id)).body;assert.equal(checkpoints.phase,'ready');assert.equal(seen.length,5)
})

for(const people of [1,2,3])test(`ask blogger publishes ${people} distinct author cards with their own complete article and source, including a relative-best choice`,async t=>{
 const store=await fixture(t),s=state(),resource=await store.create('owner','learning',`authors-${people}`,s),sources=[source('1','a'),source('2','b'),source('3','c'),source('4','a')],queries=['核心问题','具体症状','关键关系','条件边界'];let searches=0,selections=0
 s.conversations[0].messages=[{id:'q-before',role:'user',text:'前面这个式子我还没有理解。'},{id:'a-before',role:'assistant',text:'此前的讲解，不代表用户已经理解。'}]
 sources[0]={...sources[0],comments:['读者指出适用条件'],editedAt:1700000000,badge:'认证原文',rankingScore:1.4,authorSignature:'opaque-token'}
 const llm={complete:async input=>{const c=JSON.parse(input.messages[1].content);let out
  assert.equal(c.conversation[0].content,'前面这个式子我还没有理解。');assert.equal(c.conversation[1].role,'assistant')
  if(c.candidates){assert.deepEqual(c.candidates[0].comments,['读者指出适用条件']);assert.equal(c.candidates[0].editedAt,1700000000)}
  if(!c.candidates)out={queries}
  else {selections++;out={normalizedQuestion:'该怎么处理',selections:Array.from({length:people},(_,i)=>({evidenceId:`E${i+1}`,reason:'这篇至少解释其中一个具体操作',limitation:'未覆盖全部情境'}))}}
  return {kind:'completed',text:JSON.stringify(out)}
 }}
 const tools=new ProductTools(llm,{search:async q=>{assert.equal(q,queries[searches++]);return {kind:'hits',items:sources}},direct:()=>assert.fail('no fallback')})
 await store.enqueue('owner',resource.id,'learning.author','ask',{conversationId:'chat',depth:'fast',context:replyInput(s,'该怎么处理',['host'],'chat'),excludedAuthorIds:['old-author']})
 await createFlows(tools)(new TaskContext(store,await store.claim(),new AbortController().signal))
 const result=await store.snapshot('owner',resource.id),message=result.data.conversations[0].messages.at(-1),cards=result.data.nodes.filter(n=>n.type==='author')
 assert.equal(result.job.status,'completed');assert.equal(searches,4);assert.equal(selections,1);assert.equal(cards.length,people);assert.equal(message.paragraphs.length,people)
 assert.equal(new Set(cards.map(n=>n.author.id)).size,people)
 for(const [i,card] of cards.entries()){assert.deepEqual(card.parents,['host']);assert.equal(card.text,sources[i].summary);assert.equal(card.author.url,sources[i].url);assert.equal(card.author.coverageLimit,'未覆盖全部情境');assert.equal(message.paragraphs[i].id,card.id)}
 validateTree(result.data.nodes);LearningSchema.parse(result.data)
 const discovered=(await readAuthorNetwork(store.db,'owner')).authors.find(a=>a.id==='a').evidence.find(e=>e.evidenceId==='1')
 assert.deepEqual(discovered.comments,['读者指出适用条件']);assert.equal(discovered.editedAt,1700000000);assert.equal(discovered.authorSignature,'opaque-token')
 assert.equal((paragraphsMarkdown(message.paragraphs,result.data.articles).match(/^## /gm)??[]).length,people)
})
