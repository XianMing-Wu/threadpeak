import test from 'node:test'
import assert from 'node:assert/strict'
import {openDatabase,migrate} from './database.ts'
import {DurableStore} from './store.ts'
import {TaskContext,DurableWorker} from './worker.ts'
import {ProductTools} from './tools.ts'
import {createAgentLlmProvider} from '../agent-runtime/llm-provider.ts'
import {R1OutputSchema} from '../agent-runtime/schemas.ts'
import {OUTPUT_STRUCTURE_TEXT} from '../agent-runtime/prompts.ts'
import {ROUTE_INTERVIEW_OUTPUT} from '../path-generation/direct-route.ts'
import {packZhihuSearchQueries} from '../agent-runtime/pack-search.ts'
const goal='我想要快速理解transformer，请给我规划一下'
const querySet=last=>({queries:[
 {id:'Q1',text:'transformer有哪些入门方式',angle:'normal_learning',purpose:'发现学法'},
 {id:'Q2',text:'transformer入门书籍课程推荐',angle:'normal_learning',purpose:'发现学习载体'},
 {id:'Q3',text:'transformer的数学基础要学到什么程度',angle:'pitfall_or_dispute',purpose:'确定相关基础范围'},
 {id:'Q4',text:last,angle:'pitfall_or_dispute',purpose:'比较学习顺序和资料进入方式'},
]})
async function setup(t){const db=await openDatabase();await migrate(db);t.after(()=>db.close());let clock=Date.now();const store=new DurableStore(db,()=>clock);const r=await store.create('owner','path','reliability',{goal});await store.enqueue('owner',r.id,'test','reliability',{depth:'fast'});return {store,r,advance:()=>{clock+=60_000}}}
function provider(outputs,requests){return createAgentLlmProvider({config:{deepseekApiKey:'test',deepseekBaseUrl:'https://example.invalid',deepseekModelName:'test'},http:async(_url,init)=>{requests.push(JSON.parse(init.body));const value=outputs.shift();assert.notEqual(value,undefined,'unexpected model retry');if(value===503)return {ok:false,status:503,text:async()=>'{"error":{"code":"server_error"}}'};return {ok:true,status:200,text:async()=>JSON.stringify({choices:[{finish_reason:'stop',message:{content:typeof value==='string'?value:JSON.stringify(value)}}]})}}})}
test('the actual R1 output example passes its own schema and two-lane query packing',()=>{
 const value=R1OutputSchema.parse(JSON.parse(OUTPUT_STRUCTURE_TEXT.R1));assert.equal(packZhihuSearchQueries(value.queries).length,2)
})
test('all three production false positives and natural variants pass R1 without repair or query rewriting',async t=>{
 const {store}=await setup(t),ctx=new TaskContext(store,await store.claim(),new AbortController().signal)
 for(const [i,text] of ['transformer先看论文还是先看讲解','transformer先看代码还是先看讲解','transformer先看论文还是先看教程','Attention Is All You Need 读不懂怎么办','Transformer先动手再读论文行不行'].entries()){
  const requests=[],expected=querySet(text),tools=new ProductTools(provider([expected],requests),{})
  const actual=await tools.planStep(ctx,'R1',{goal},{},`R1-variant-${i}`)
  assert.deepEqual(actual,expected);assert.equal(requests.length,1);assert.equal(requests[0].response_format.type,'json_object')
  assert.ok(packZhihuSearchQueries(actual.queries).some(q=>q.query.includes(text)))
 }
})
test('malformed JSON recovers valid bounded queries before worker publishes without replay',async t=>{
 const {store,r}=await setup(t),requests=[],valid=querySet('transformer先看论文还是先看教程')
 const invalid=structuredClone(valid);invalid.queries[1].id='Q1';invalid.queries[2].angle='invented_angle'
 const tools=new ProductTools(provider(['{"queries":',invalid,valid],requests),{})
 const worker=new DurableWorker(store,async ctx=>{const output=await tools.planStep(ctx,'R1',{goal});await store.commit(ctx.job,()=>output)},1,()=>{})
 await worker.execute(await store.claim());const snapshot=await store.snapshot('owner',r.id)
 assert.equal(snapshot.job.status,'completed');R1OutputSchema.parse(snapshot.data);packZhihuSearchQueries(snapshot.data.queries);assert.equal(requests.length,1)
 assert.ok(requests.every(r=>r.messages[0].content===requests[0].messages[0].content&&JSON.stringify(r.thinking)===JSON.stringify(requests[0].thinking)))
 assert.ok(snapshot.data.queries.every(q=>q.text.toLowerCase().includes('transformer')))
 assert.ok(!(await store.events('owner',r.id,0)).some(e=>e.kind==='job.waiting'))
})
test('a provider outage is recovered in the same task without repeating the completed query plan',async t=>{
 const {store,r,advance}=await setup(t),requests=[],valid=querySet('transformer先看论文还是先看教程')
 const tools=new ProductTools(provider([valid,503,{ok:true}],requests),{})
 const worker=new DurableWorker(store,async ctx=>{await tools.planStep(ctx,'R1',{goal});const result=await tools.structured(ctx,'next','same system',{},x=>{assert.equal(x.ok,true);return x});await store.commit(ctx.job,()=>result)},1,()=>{})
 const first=await store.claim();await worker.execute(first);assert.equal((await store.snapshot('owner',r.id)).job.status,'queued')
 advance();const resumed=await store.claim();assert.equal(resumed.id,first.id);await worker.execute(resumed)
 assert.equal((await store.snapshot('owner',r.id)).job.status,'completed');assert.equal(requests.length,3)
 assert.ok(!(await store.events('owner',r.id,0)).some(e=>e.kind==='job.waiting'))
})
test('interview experience and conditional course mentions are not rejected by substring matching',async t=>{
 const {store}=await setup(t),ctx=new TaskContext(store,await store.claim(),new AbortController().signal),requests=[]
 const output=JSON.parse(ROUTE_INTERVIEW_OUTPUT)
 output.questions[0].prompt='上一次调试代码花了多少时间，最后能定位问题吗？'
 output.questions[0].options[0].routeEffect='若现在能完成对应操作，不重复学习GAMES101的基础复习章节'
 const tools=new ProductTools(provider([output],requests),{})
 assert.deepEqual(await tools.routeInterview(ctx,{goal:'理解图形学',firstSearch:{summary:'候选课程GAMES101包含基础复习'},catalogCarriers:['GAMES101']}),output)
 assert.equal(requests.length,1)
})
