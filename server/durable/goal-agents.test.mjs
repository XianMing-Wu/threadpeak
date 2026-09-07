import {placeAnswer} from '../../tests/fixtures/card-answer.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {openDatabase,migrate} from './database.ts'
import {DurableStore} from './store.ts'
import {TaskContext,DurableWorker} from './worker.ts'
import {createProductApp} from './http.ts'
import {ProductTools} from './tools.ts'
import {appendQuestionSet,selectPathCustomAnswer,selectPathOption,replyInput,createFlows} from './flows.ts'
import {pathGoalContext,hydrateLearningGoal} from './learning-goal.ts'
import {planningMaterial,inheritedArticles} from './materials.ts'
import {packContext,boundedSummary,tokenBound} from './context.ts'
import {semanticChunks} from '../agent-runtime/semantic-chunks.ts'
import {validateGoalExploration} from '../path-generation/goal-exploration.ts'
import {validateGoalPlan,compileStagedPlan} from '../path-generation/staged-plan.ts'
import {plan,interview,exploration,goal} from '../../tests/fixtures/goal-agents.mjs'

const material={ref:'F1',sourceId:'owned-file',fileName:'收藏',content:'坐标表示基下的分量。'}
async function fixture(t){const db=await openDatabase();await migrate(db);t.after(()=>db.close());return new DurableStore(db)}
async function context(store,key='test'){const resource=await store.create('owner','test',key,{});await store.enqueue('owner',resource.id,'test',key,{depth:'fast'});return new TaskContext(store,await store.claim(60000),new AbortController().signal)}
test('custom answers remain literal, exclusive and immutable across superseded rounds',()=>{
  const path={goal:'读论文的数学，不为求职',attachments:[],questionSets:[],conversation:[],status:'running'}
  appendQuestionSet(path,interview());const q=path.questionSets[0].questions[0],resource={kind:'path',body:path}
  const custom='  我希望推清公式，但不想准备面试。\n目前只会矩阵乘法。'
  selectPathCustomAnswer(resource,q.id,custom);selectPathCustomAnswer(resource,q.id,custom)
  assert.equal(path.conversation.length,2)
  assert.equal(path.questionSets[0].customAnswers[q.id],custom)
  assert.deepEqual(path.questionSets[0].selectedOptionIds,{})
  assert.throws(()=>selectPathOption(resource,q.id,q.options[0].id),/ANSWER_ALREADY_SAVED/)
  path.questionSets[0].status='superseded';appendQuestionSet(path,{...interview(),round:2})
  path.conversation.push({messageId:'free-followup',role:'user',content:'后来想清楚了，只要复现论文图表，暂不推完整证明。'})
  const restored=pathGoalContext(JSON.parse(JSON.stringify(path)))
  assert.equal(restored.rawGoal,path.goal);assert.equal(restored.userStatements[0].text,custom)
  assert.equal(restored.userStatements.at(-1).text,path.conversation.at(-1).content)
  assert.throws(()=>selectPathCustomAnswer(resource,q.id,'修改旧答案'),/QUESTION_NOT_FOUND/)
})
test('exploration retains conditional perspectives and rejects invented evidence bindings',()=>{
  const output=exploration();output.perspectives=[{id:'P1',advice:'先写代码',forWhom:'作品实践者',conditions:'目标是跑通现成方法',tradeoffs:'不能因此解释所有推导',fitToGoal:'仅在复现目标下合适',basis:'source',sourceRefs:['evidence-one']}]
  output.candidates[0].perspectiveRefs=['P1']
  const input={searchGroups:[{results:[{evidenceId:'evidence-one'}]}],attachments:[material]}
  assert.deepEqual(validateGoalExploration(output,input),output)
  output.perspectives[0].sourceRefs=['forged'];assert.throws(()=>validateGoalExploration(output,input),/本次 evidenceId/)
  output.candidates[0].materialRefs=['evidence-one'];assert.throws(()=>validateGoalExploration(output,input),/materialRefs/)
})
test('fresh plans cannot invent a user profile or hide it inside assumptions',()=>{
  const output=plan(),input={attachments:[material],goalContext:{rawGoal:'想读论文',userStatements:[{text:'我有两年 Python 后端经验，不准备考试，没有给自己限定时间。'}]}}
  Object.assign(output.learningGoal,{startingPoint:'我有两年 Python 后端经验',motivation:'',constraints:['没有给自己限定时间'],nonGoals:['不准备考试'],assumptions:[]})
  assert.doesNotThrow(()=>validateGoalPlan(output,input))
  output.learningGoal.startingPoint='熟悉数据库和 API 开发';assert.throws(()=>validateGoalPlan(output,input),/startingPoint.*原话/)
  output.learningGoal.startingPoint='';output.learningGoal.assumptions=['收入稳定，风险承受能力低'];assert.throws(()=>validateGoalPlan(output,input),/assumptions/)
})
test('every new concept needs goal, depth, check and a grounded direct or prerequisite material anchor',()=>{
  const output=plan(),input={attachments:[material]}
  const concept=output.stages[0][0].concepts[0]
  concept.title='线性组合';concept.goalAlignment.materialAnchors[0].role='prerequisite'
  concept.goalAlignment.materialAnchors[0].connection='要理解坐标是基下的分量，必须先理解用基向量线性组合表示向量。'
  const checked=validateGoalPlan(output,input),route=compileStagedPlan(checked,'user-path',['owned-file'],new Set(['F1']))
  assert.equal(route.learningGoal.outcome,output.learningGoal.outcome)
  assert.equal(route.concepts[0].goalAlignment.materialAnchors[0].sourceId,'owned-file')
  assert.equal(route.concepts[0].goalAlignment.materialAnchors[0].evidenceKind,'context_summary')
  const bad=structuredClone(output);delete bad.stages[0][0].concepts[0].goalAlignment
  assert.throws(()=>validateGoalPlan(bad,input),/goalAlignment/)
  concept.goalAlignment.materialAnchors[0].quote='这是文件中不存在的公式';assert.throws(()=>validateGoalPlan(output,input),/引文不在/)
})
test('new interview calls repair non-three choices with the same prompt and freeze custom placeholder outside options',async t=>{
  const store=await fixture(t),ctx=await context(store),calls=[]
  const tools=new ProductTools({complete:async call=>{calls.push(call);const value=interview();if(calls.length===1)value.questions[0].options.pop();return {kind:'completed',text:JSON.stringify(value)}}},{})
  const result=await tools.legacy(ctx,'R3',{goalContext:{rawGoal:'读论文',userStatements:[]},exploration:exploration()})
  assert.equal(result.questions[0].options.length,3);assert.equal(calls.length,2)
  assert.equal(calls[0].messages[0].content,calls[1].messages[0].content)
})
test('first teaching reviews every source without turning every source into another paragraph',async t=>{
  const store=await fixture(t),ctx=await context(store),calls=[]
  const allowedCards=Array.from({length:10},(_,i)=>({id:`source-${i}`,title:`资料 ${i}`,content:`材料 ${i} 的同一个定义。`}))
  const tools=new ProductTools({complete:async call=>{
    calls.push(call);const input=JSON.parse(call.messages[1].content);if(input.citationCatalog)return {kind:'completed',text:JSON.stringify(placeAnswer(input))};const cards=input.read_card_scope.cards
    assert.equal(cards.length,10);assert.equal(input.answerBounds.maxCards,8)
    return {kind:'completed',text:JSON.stringify({sourceReview:cards.map(c=>({ref:c.ref,contribution:'重复定义，只选择其中的清晰例子讲解'})),sections:cards.slice(0,calls.length===1?10:2).map(c=>({after:c.ref,title:'当前概念的解释',text:'围绕当前问题说明一个要点。'}))})}
  }},{})
  const output=await tools.answerCards(ctx,{allowedCards,directAnswers:[],concept:{title:'当前概念'},currentQuestion:'这个概念怎样用于目标？'})
  assert.equal(calls.length,3);assert.equal(output.paragraphs.length,2)
  assert.equal(calls[0].messages[0].content,calls[1].messages[0].content)
})
test('compression preserves complete intent and user negatives, and purpose isolates cached summaries',async t=>{
  const store=await fixture(t),ctx=await context(store),calls=[]
  const llm={complete:async call=>{calls.push(call);assert.ok(call.messages.reduce((n,m)=>n+tokenBound(m.content)+64,0)+call.maxTokens+1024<=32000);return {kind:'completed',text:'材料仅在已知基且线性独立时适用，不能推广到任意向量组。'}}}
  const core={rawGoal:'我只想画可旋转的图，不准备考试。',userStatements:[{id:'custom',question:'怎样算学会？',text:'能在电脑上拖动它就够了，不要求推导。'}]}
  const input={goalContext:core,concept:{id:'c',title:'旋转',description:'只学习作品需要的变换'},currentQuestion:'为什么要变换坐标？',conversation:[{role:'user',messageId:'u',content:'不要先讲完整的高等数学。'}],attachments:[{...material,content:'原始正文。'.repeat(12000)+'末尾限定条件。'}]}
  const before=structuredClone(input),result=JSON.parse((await packContext(llm,ctx,'任务',input,'fast',{window:32000,output:4096,margin:2048}))[1].content)
  assert.deepEqual(input,before);assert.deepEqual(result.goalContext,core);assert.deepEqual(result.conversation,input.conversation);assert.deepEqual(result.concept,input.concept)
  assert.ok(calls.some(c=>JSON.parse(c.messages[1].content).text.includes('末尾限定条件')))
  const text='带条件的材料。'.repeat(1000),purpose={goal:'做出作品'}
  await boundedSummary(llm,ctx,text,'file',800,'fast',32000,purpose);const count=calls.length
  await boundedSummary(llm,ctx,text,'file',800,'fast',32000,purpose);assert.equal(calls.length,count)
  await boundedSummary(llm,ctx,text,'file',800,'fast',32000,{goal:'推清证明'});assert.ok(calls.length>count)
})
test('semantic chunks keep code and math together when possible and retain every character when oversized',()=>{
  const code='```python\nx = [\n  1, 2, 3\n]\n```\n\n',math='$$\nA x = b\n$$\n\n'
  const text='前言。\n\n'+code+math+'尾部限制。'.repeat(500)
  const chunks=semanticChunks(text,100,tokenBound)
  assert.equal(chunks.join(''),text);assert.ok(chunks.every(c=>tokenBound(c)<=100))
  assert.ok(chunks.some(c=>c.includes(code)));assert.ok(chunks.some(c=>c.includes(math)))
})
test('PDF planning starts from parsed mathematics and labels summary-only materials honestly',()=>{
  const record={id:'pdf',body:{fileName:'论文.pdf',mimeType:'application/pdf',origin:'upload',content:'泛化总结未提公式',rawContent:'开头。\n$$A x=b$$\n最后一页的限制条件。'}}
  const before=structuredClone(record),parsed=planningMaterial(record)
  assert.equal(parsed.content,record.body.rawContent);assert.equal(parsed.contentBasis,'parsed_document');assert.equal(parsed.rawContent,undefined)
  assert.equal(inheritedArticles([parsed])[0].topic,'PDF 正文');assert.deepEqual(record,before)
  record.body.rawContent='';assert.equal(planningMaterial(record).contentBasis,'source_summary')
})
test('old learning records recover only their own original route goal, never another owner or a title guess',async t=>{
  const store=await fixture(t),route=compileStagedPlan(plan(),'old-route',['owned-file'])
  const base={routeId:route.routeId,conceptId:route.concepts[0].id,title:'普通标题'}
  const learning=await store.create('owner','learning','old',base)
  const path={goal:'读论文而非面试',status:'published',route,conversation:[]}
  await store.create('other-owner','path','other',path)
  assert.equal((await hydrateLearningGoal(store,'owner',learning.id)).body.goalContext,undefined)
  await store.create('owner','path','own',path)
  const restored=await hydrateLearningGoal(store,'owner',learning.id)
  assert.equal(restored.body.goalContext.rawGoal,path.goal)
  assert.equal((await hydrateLearningGoal(store,'owner',learning.id)).revision,restored.revision)
})
test('HTTP custom submission survives reload, auto-plans, carries owned goal into learning and keeps it after new chat',async t=>{
  const store=await fixture(t),seen=[]
  const tools={legacy:async(_ctx,agent,input)=>{if(agent==='R1')return {queries:[0,1,2,3].map(i=>({id:String(i),text:`坐标 ${i}`,angle:i<2?'normal_learning':'pitfall_or_dispute'}))};if(agent==='R2')return exploration();return interview()},search:async()=>[],routePlan:async(_ctx,input)=>{seen.push(input);const output=plan();output.learningGoal=goal('只看懂论文，不准备面试');return compileStagedPlan(output,'published',['owned-file'])}}
  const worker=new DurableWorker(store,createFlows(tools),1,()=>{})
  const app=await createProductApp({store,worker,providersReady:true,identity:{production:false}});t.after(async()=>{await worker.stop();await app.close()})
  const session=await app.inject({url:'/api/v2/session'}),headers={cookie:session.headers['set-cookie'].split(';')[0]}
  const owner=(await store.db.query('SELECT owner_id FROM tp_sessions'))[0].owner_id
  async function finish(id){for(let i=0;i<300;i++){const s=await store.snapshot(owner,id);if(s.job?.status==='completed')return s;if(s.job?.status==='waiting')throw Error(s.job.error_code);await new Promise(r=>setTimeout(r,10))}throw Error('timeout')}
  const started=await app.inject({method:'POST',url:'/api/path-runs',headers,payload:{goal:'为了读论文学习数学'}});assert.equal(started.statusCode,202)
  const id=started.json().runId,start=await finish(id),q=start.data.questionSets[0].questions[0]
  const answer={questionId:q.id,customAnswer:'我只想看懂论文，不准备面试。'}
  const saved=await app.inject({method:'POST',url:`/api/path-runs/${id}/select`,headers:{...headers,'idempotency-key':'custom-save-command'},payload:answer});assert.equal(saved.statusCode,200)
  const done=await finish(id);assert.equal(done.data.status,'published');assert.equal(seen[0].goalContext.userStatements.at(-1).text,answer.customAnswer)
  const reloaded=await app.inject({url:`/api/path-runs/${id}`,headers});assert.equal(reloaded.json().questionSets[0].customAnswers[q.id],answer.customAnswer)
  const replay=await app.inject({method:'POST',url:`/api/path-runs/${id}/select`,headers:{...headers,'idempotency-key':'custom-save-command'},payload:answer});assert.equal(replay.statusCode,200);assert.equal(seen.length,1)
  // Already initialized test resource isolates propagation from provider behavior tested above.
  const concept=done.data.route.concepts[0],goalContext=pathGoalContext(done.data,concept.id)
  const state={version:2,routeId:done.data.document.id,conceptId:concept.id,title:concept.title,description:concept.detailedDescription,hasDispute:false,initialized:true,phase:'ready',articles:[],nodes:[{id:'root',type:'root',title:concept.title,text:'',sources:[],parents:[]}],active:'old',conversations:[{id:'old',title:'初次',date:'2026-09-07',messages:[]}]}
  await store.create(owner,'learning',`${id}:${concept.id}`,state)
  const entered=await app.inject({method:'POST',url:'/api/v2/learning/enter',headers,payload:{routeId:id,conceptId:concept.id,goalContext:{rawGoal:'client-forged'}}})
  assert.equal(entered.statusCode,200);assert.deepEqual(entered.json().data.goalContext,goalContext)
  const learningId=entered.json().id
  await store.edit(owner,learningId,undefined,r=>{const {goalContext,...old}=r.body;return old})
  const direct=await app.inject({url:`/api/v2/resources/${learningId}`,headers})
  assert.deepEqual(direct.json().data.goalContext,goalContext)
  const fresh=await app.inject({method:'POST',url:`/api/v2/learning/${learningId}/commands`,headers,payload:{kind:'new-conversation',conversationId:'new'}})
  assert.equal(fresh.statusCode,200);assert.deepEqual(fresh.json().data.goalContext,goalContext)
  const input=replyInput(fresh.json().data,'这一步为什么需要？',['root'],'new')
  assert.deepEqual(input.goalContext,goalContext);assert.deepEqual(input.conversation,[])
})
