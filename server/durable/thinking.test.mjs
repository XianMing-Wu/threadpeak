import test from 'node:test'
import assert from 'node:assert/strict'
import {createAgentLlmProvider} from '../agent-runtime/llm-provider.ts'
import {openDatabase,migrate} from './database.ts'
import {DurableStore} from './store.ts'
import {TaskContext} from './worker.ts'
import {ProductTools} from './tools.ts'
import {modelCall} from './model-call.ts'
import {pathTrace} from './path-trace.ts'
const config={deepseekBaseUrl:'https://api.deepseek.com',deepseekApiKey:'test-only',deepseekModelName:'deepseek-flash'}
const input={messages:[{role:'user',content:'测试问题'}],json:true,thinkingDepth:'fast'}
const frame=data=>'data: '+JSON.stringify(data)+'\n\n'
const encoder=new TextEncoder()
const chunk=(delta,finish_reason=null)=>frame({choices:[{delta,finish_reason}]})
async function fixture(t){const db=await openDatabase();await migrate(db);t.after(()=>db.close());const store=new DurableStore(db);const resource=await store.create('owner','path','test',{status:'running',questionSets:[]});await store.enqueue('owner',resource.id,'path.start','thinking-test',{depth:'fast'});const job=await store.claim();return {db,store,resource,job,ctx:new TaskContext(store,job,new AbortController().signal)}}

test('fast disables thinking without effort; deep enables low; catalog extraction stays disabled',async()=>{
 const requests=[]
 const llm=createAgentLlmProvider({config,http:async(_url,init)=>{requests.push(JSON.parse(init.body));return {ok:true,status:200,text:async()=>JSON.stringify({choices:[{finish_reason:'stop',message:{content:'{"ok":true}'}}]})}}})
 for(const options of [{thinkingDepth:'fast'},{thinkingDepth:'deep'},{thinkingDepth:'deep',thinking:'disabled'},{thinkingDepth:'fast',thinking:'enabled'}])assert.equal((await llm.complete({...input,...options})).kind,'completed')
 assert.deepEqual(requests.map(r=>[r.model,r.thinking.type,r.reasoning_effort]),[['deepseek-flash','disabled',undefined],['deepseek-flash','enabled','low'],['deepseek-flash','disabled',undefined],['deepseek-flash','disabled',undefined]])
 assert.ok(requests.filter(r=>r.thinking.type==='disabled').every(r=>!Object.hasOwn(r,'reasoning_effort')))
 assert.ok(requests.every(r=>!('temperature' in r)))
})

test('truncated structured output increases its cap within the same operation and only checkpoints a complete validated result',async t=>{
 const {ctx,job}=await fixture(t),requests=[]
 const llm=createAgentLlmProvider({config,http:async(_url,init)=>{
  const body=JSON.parse(init.body);requests.push(body)
  return {ok:true,status:200,text:async()=>JSON.stringify({choices:[{finish_reason:requests.length===1?'length':'stop',message:{content:requests.length===1?'{"ok":':'{"ok":true}'}}]})}
 }})
 const tools=new ProductTools(llm,{},500000)
 const result=await tools.structured(ctx,'L-answer:attach-test','same system',{},v=>{assert.equal(v.ok,true);return v},4096)
 assert.deepEqual(result,{ok:true});assert.deepEqual(requests.map(r=>r.max_tokens),[4096,8192])
 assert.ok(requests.every(r=>r.thinking.type==='disabled'&&r.messages[0].content==='same system'))
 const successful=Object.entries(job.checkpoints).filter(([key])=>key.startsWith('L-answer:attach-test@'))
 assert.equal(successful.length,1);assert.deepEqual(successful[0][1].value,{ok:true})
})

test('a truncated response at the configured output ceiling fails without repeating the same inadequate request',async t=>{
 const {ctx,job}=await fixture(t);let calls=0
 const tools=new ProductTools({complete:async()=>{calls++;return {kind:'failed',code:'OUTPUT_TRUNCATED',retryable:true}}},{},{llm:{window:64000,output:4096,namespace:'test'}})
 await assert.rejects(tools.structured(ctx,'bounded','same system',{},v=>v,4096),e=>e.code==='OUTPUT_TRUNCATED'&&!e.retryable)
 assert.equal(calls,1);assert.equal(Object.keys(job.checkpoints).length,0)
})

test('real stream adapter persists reasoning before a formal result, restores via owner snapshot and keeps event logs/body clean',async t=>{
 const {store,resource,job,ctx}=await fixture(t)
 let stream
 const llm=createAgentLlmProvider({config,http:async(_url,init)=>{assert.equal(JSON.parse(init.body).stream,true);return {ok:true,status:200,body:new ReadableStream({start(c){stream=c}}),text:async()=>''}}})
 const promise=new ProductTools(llm,{search:async()=>({kind:'empty'})},500000).structured(ctx,'R1','只返回JSON',{},v=>{assert.equal(v.ok,true);return v})
 while(!stream)await new Promise(r=>setTimeout(r,1))
 stream.enqueue(encoder.encode(chunk({reasoning_content:'先核对目标，再比较必要条件。'})))
 await new Promise(r=>setTimeout(r,10));await ctx.flush()
 const live=await store.snapshot('owner',resource.id)
 assert.equal(live.job.draft,'');assert.equal(live.data.status,'running')
 assert.equal(live.job.activities[0].thought,'先核对目标，再比较必要条件。')
 assert.equal(live.job.activities[0].status,'running')
 await assert.rejects(store.snapshot('different-owner',resource.id))
 const trace=pathTrace([{...job,activities:live.job.activities}],live.data)
 assert.equal(trace.find(s=>s.kind==='think').thought,'先核对目标，再比较必要条件。')
 const events=await store.db.query('SELECT payload FROM tp_events WHERE resource_id=$1',[resource.id]);assert.ok(!JSON.stringify(events).includes('先核对目标'))
 stream.enqueue(encoder.encode(chunk({content:'{"ok":true}'},'stop')+'data: [DONE]\n\n'));stream.close()
 assert.deepEqual(await promise,{ok:true});await ctx.flush()
 const final=await store.snapshot('owner',resource.id);assert.equal(final.job.activities[0].status,'done');assert.equal(final.job.draft,'')
 assert.ok(Object.values(job.checkpoints).some(c=>c.value?.ok===true))
 assert.ok(!JSON.stringify(job.checkpoints).includes('先核对目标'))
})

test('reasoning-only or truncated stream preserves its separate incomplete state, never a successful result',async t=>{
 const {ctx,store,resource}=await fixture(t)
 const llm=createAgentLlmProvider({config,http:async()=>({ok:true,status:200,body:new ReadableStream({start(c){c.enqueue(encoder.encode(chunk({reasoning_content:'正在比较资料'},'length')+'data: [DONE]\n\n'));c.close()}}),text:async()=>''})})
 const result=await modelCall(llm,ctx,'R4-plan:direct-v6','安排顺序',input)
 assert.equal(result.kind,'failed');assert.equal(result.code,'OUTPUT_TRUNCATED')
 const snapshot=await store.snapshot('owner',resource.id);assert.equal(snapshot.job.draft,'');assert.equal(snapshot.job.activities[0].status,'waiting');assert.equal(snapshot.data.status,'running')
})

test('repair uses the same depth and keeps separate reasoning for each attempt',async t=>{
 const {ctx,store,resource}=await fixture(t);ctx.job.input.depth='deep'
 const requests=[];const llm={complete:async r=>{requests.push(r);r.onReasoning('第'+requests.length+'次核对');return {kind:'completed',text:requests.length===1?'wrong':'{"ok":true}'}}}
 await new ProductTools(llm,{search:async()=>({kind:'empty'})},500000).structured(ctx,'R3:v6','same prompt',{},v=>v)
 const snapshot=await store.snapshot('owner',resource.id);assert.equal(snapshot.job.activities.length,2);assert.equal(new Set(snapshot.job.activities.map(a=>a.id)).size,2)
 assert.ok(requests.every(r=>r.thinkingDepth==='deep'));assert.equal(snapshot.job.draft,'')
})

test('cancellation fences late reasoning writes and cannot publish a completion',async t=>{
 const {ctx,store,resource}=await fixture(t);const entered=Promise.withResolvers(),release=Promise.withResolvers();let callback
 const pending=modelCall({complete:async r=>{callback=r.onReasoning;r.onReasoning('已收到的思考');entered.resolve();await release.promise;r.onReasoning('不应落库的迟到内容');return {kind:'completed',text:'{"ok":true}'}}},ctx,'R1','理解目标',input)
 await entered.promise;await ctx.flush();await store.cancel('owner',resource.id);release.resolve()
 await assert.rejects(pending,e=>e.code==='LEASE_LOST');callback('另一个迟到片段')
 const snapshot=await store.snapshot('owner',resource.id);assert.equal(snapshot.job.status,'cancelled');assert.equal(snapshot.job.activities[0].thought,'已收到的思考');assert.equal(snapshot.job.draft,'')
})

test('resuming a model step keeps old interrupted reasoning and starts a fresh activity',async t=>{
 const {ctx,store,resource}=await fixture(t)
 await ctx.activity('R1:thinking:old','think','理解目标','running',undefined,{thought:'中断前的思考',step:'R1'})
 await modelCall({complete:async r=>{r.onReasoning('恢复后的思考');return {kind:'completed',text:'{"ok":true}'}}},ctx,'R1','理解目标',input)
 const activities=(await store.snapshot('owner',resource.id)).job.activities
 assert.equal(activities[0].status,'waiting');assert.equal(activities[0].thought,'中断前的思考');assert.equal(activities[1].status,'done')
})

test('a new route follow-up freezes its selected depth, independently of the already accepted route',async t=>{
 const {createProductApp}=await import('./http.ts')
 const {db,store}=await fixture(t)
 const app=await createProductApp({store,worker:{wake(){},stop:async()=>{}},providersReady:true,identity:{production:false}});t.after(()=>app.close())
 const guest=await app.inject({url:'/api/auth/guest',method:'POST',payload:{}});const cookie=String(guest.headers['set-cookie']).split(';')[0]
 const own=(await db.query('SELECT owner_id FROM tp_sessions'))[0].owner_id
 const route=await store.create(own,'path','published-depth',{goal:'已保存目标',depth:'deep',status:'published',questionSets:[],conversation:[]})
 for(const depth of ['fast','deep']){
  const response=await app.inject({url:`/api/path-runs/${route.id}/reply`,method:'POST',headers:{cookie,'idempotency-key':`follow-depth-${depth}`},payload:{message:'解释路线中的这一步',thinkingDepth:depth}})
  assert.equal(response.statusCode,200)
  const [job]=await db.query('SELECT input FROM tp_jobs WHERE resource_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1',[route.id]);assert.equal(job.input.depth,depth)
  assert.equal((await store.resource(own,route.id)).body.depth,'deep')
  await store.cancel(own,route.id)
 }
})

test('plain answers and long-material summaries recover truncated output without changing input or depth',async t=>{
 const {boundedSummary}=await import('./context.ts')
 for(const depth of ['fast','deep']){
  const {ctx}=await fixture(t)
  ctx.job.input.depth=depth
  for(const operation of ['chat','summary']){
   const requests=[]
   const llm={complete:async input=>{requests.push(input);return requests.length===1?{kind:'failed',code:'OUTPUT_TRUNCATED',retryable:true}:{kind:'completed',text:'完整且有条件的回答。'}}}
   const tools=new ProductTools(llm,{},{llm:{window:500000,output:32768,namespace:'test'}})
   const output=operation==='chat'?await tools.chat(ctx,{question:`问题-${depth}`}):await boundedSummary(llm,ctx,'原文：旋转须声明方向与中心。',`source-${depth}`,1024,depth,500000,{},tools.capabilities.llm)
   assert.equal(output,'完整且有条件的回答。');assert.equal(requests.length,2)
   assert.ok(requests[1].maxTokens>requests[0].maxTokens)
   assert.ok(requests.every(r=>r.thinkingDepth===depth))
   assert.equal(requests[0].messages[0].content,requests[1].messages[0].content)
   assert.equal(requests[0].messages[1].content,requests[1].messages[1].content)
  }
 }
})

test('fast tasks enable low only for final route planning, including its same-agent repairs',async t=>{
 const {ctx}=await fixture(t),requests=[]
 const llm=createAgentLlmProvider({config,http:async(_url,init)=>{requests.push(JSON.parse(init.body));return {ok:true,status:200,text:async()=>JSON.stringify({choices:[{finish_reason:'stop',message:{content:'{}'}}]})}}})
 const tools=new ProductTools(llm,{},{llm:{window:500000,output:32768,namespace:'test'}})
 await assert.rejects(tools.routePlan(ctx,{workflow:'route-direct-v6',goal:'理解坐标'},'test',[]),e=>e.code==='STRUCTURE_NOT_SETTLED')
 assert.equal(ctx.job.input.depth,'fast');assert.equal(requests.length,3)
 assert.ok(requests.every(r=>r.thinking.type==='enabled'&&r.reasoning_effort==='low'&&r.model==='deepseek-flash'))
 assert.equal(new Set(requests.map(r=>r.messages[0].content)).size,1)
 const offset=requests.length
 await tools.structured(ctx,'L-search-plan','search',{},v=>v,4096)
 assert.ok(requests.slice(offset).every(r=>r.thinking.type==='disabled'&&!Object.hasOwn(r,'reasoning_effort')))
})
