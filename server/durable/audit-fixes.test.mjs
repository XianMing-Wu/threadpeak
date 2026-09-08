import test from 'node:test'
import assert from 'node:assert/strict'
import {openDatabase,migrate} from './database.ts'
import {DurableStore} from './store.ts'
import {TaskContext} from './worker.ts'
import {ProductTools} from './tools.ts'
import {resolveCapabilities} from './capabilities.ts'
import {boundedSummary,tokenBound} from './context.ts'
import {ROUTE_STEP_SPECS} from './agent-specs.ts'
import {createAgentLlmProvider} from '../agent-runtime/llm-provider.ts'
import {createFlows,replyInput} from './flows.ts'
import {platformCases} from './audit-platform-cases.mjs'
const capabilities={llm:{window:240000,output:16000,namespace:'large-model-a'},zhihu:{fast:{window:32000,output:8000,namespace:'small-direct'},deep:{window:40000,output:12000,namespace:'deep-direct'}}}
async function fixture(t){const db=await openDatabase();await migrate(db);t.after(()=>db.close());return new DurableStore(db)}
async function context(store,key='test',owner='owner'){const r=await store.create(owner,'test',key,{});await store.enqueue(owner,r.id,'test',key,{depth:'fast'});return new TaskContext(store,await store.claim(60000),new AbortController().signal)}

test('provider capabilities have independent ceilings and production requires all verified limits',()=>{
 const local=resolveCapabilities({});assert.equal(local.llm.window,64000);assert.equal(local.zhihu.fast.window,32000)
 const configured={NODE_ENV:'production',DEEPSEEK_CONTEXT_TOKENS:'240000',DEEPSEEK_MAX_OUTPUT_TOKENS:'16000',ZHIHU_FAST_CONTEXT_TOKENS:'32000',ZHIHU_FAST_OUTPUT_TOKENS:'8000',ZHIHU_DEEP_CONTEXT_TOKENS:'40000',ZHIHU_DEEP_OUTPUT_TOKENS:'12000'}
 for(const key of Object.keys(configured).filter(k=>k!=='NODE_ENV'))assert.throws(()=>resolveCapabilities({...configured,[key]:''}),/PRODUCTION_CONFIG_REQUIRED/)
 assert.equal(resolveCapabilities(configured).zhihu.deep.window,40000)
 assert.throws(()=>resolveCapabilities({...configured,ZHIHU_FAST_OUTPUT_TOKENS:'32000'}),/MODEL_CAPABILITY_CONFIG_INVALID/)
 assert.notEqual(resolveCapabilities({...configured,DEEPSEEK_MODEL_NAME:'a'}).llm.namespace,resolveCapabilities({...configured,DEEPSEEK_MODEL_NAME:'b'}).llm.namespace)
 assert.deepEqual(Object.keys(ROUTE_STEP_SPECS),['R1','R2','R3','R3b'])
})
test('large planning and small direct windows pack independently; model changes cannot reuse stage output',async t=>{
 const store=await fixture(t),ctx=await context(store),calls=[],direct=[]
 const llm={complete:async input=>{calls.push(input);return {kind:'completed',text:input.json?'{}':'来源的范围、条件和关系摘要'}}}
 const tools=new ProductTools(llm,{direct:async input=>{direct.push(input);return {kind:'completed',text:'本次直答'}}},capabilities)
 const input={goal:'原始目标保持逐字不变',materials:[{sourceId:'s',content:'A'.repeat(100000)}]}
 await tools.structured(ctx,'probe','system',input,x=>x,1000)
 assert.equal(calls.length,1);assert.equal(JSON.parse(calls[0].messages[1].content).materials[0].content.length,100000)
 await tools.structured(ctx,'probe','system',input,x=>x,1000);assert.equal(calls.length,1)
 await tools.direct(ctx,'small-direct','L0a',input,'concrete_explanation')
 assert.equal(direct.length,1);assert.ok(direct[0].messages.reduce((n,m)=>n+tokenBound(m.content)+64,0)+8000+2048<=32000)
 assert.equal(JSON.parse(direct[0].messages[1].content).goal,input.goal);assert.equal(input.materials[0].content.length,100000)
 const before=calls.length
 await new ProductTools(llm,{}, {...capabilities,llm:{...capabilities.llm,namespace:'large-model-b'}}).structured(ctx,'probe','system',input,x=>x,1000)
 assert.equal(calls.length,before+1)
 const metrics=await store.db.query("SELECT body FROM tp_provider_calls WHERE provider='context'")
 assert.ok(metrics.some(m=>m.body.kind==='summary'&&m.body.chunkCount>=2));assert.ok(metrics.some(m=>m.body.window===32000))
 assert.ok(!JSON.stringify(metrics).includes(input.goal)&&!JSON.stringify(metrics).includes('A'.repeat(100)))
})
test('paired summary chunks retain order, checkpoint successful siblings and isolate model and owner caches',async t=>{
 const store=await fixture(t),ctx=await context(store),seen=[];let active=0,max=0,fail=true
 const llm={complete:async request=>{const input=JSON.parse(request.messages[1].content);active++;max=Math.max(max,active);seen.push(input.part);await new Promise(r=>setTimeout(r,input.part===1?10:1));active--;if(input.part===2&&fail){fail=false;return {kind:'failed',code:'NETWORK_UNAVAILABLE'}}return {kind:'completed',text:`part ${input.part}`}}}
 const original=Array.from({length:10},(_,i)=>`source section ${i}\n${'x'.repeat(10000)}\n\n`).join('')
 const run=(current,cap=capabilities.llm)=>boundedSummary(llm,current,original,'s',1024,'fast',cap.window,{goal:'完整阅读'},cap)
 await assert.rejects(run(ctx),e=>e.code==='NETWORK_UNAVAILABLE')
 assert.equal(seen.filter(n=>n===1).length,1)
 const summary=await run(ctx);assert.match(summary,/^part 1\npart 2\npart 3$/);assert.equal(max,2);assert.equal(seen.filter(n=>n===1).length,1)
 const count=seen.length;await run(await context(store,'same-owner'));assert.equal(seen.length,count)
 await run(ctx,{...capabilities.llm,namespace:'new-model'});assert.ok(seen.length>count)
 const next=seen.length;await run(await context(store,'other-owner','bob'));assert.ok(seen.length>next)
 assert.equal(original.length>100000,true)
})
test('formal malformed JSON reaches the same Agent repair through the real adapter',async t=>{
 const store=await fixture(t),ctx=await context(store),requests=[]
 const config={deepseekApiKey:'test',deepseekBaseUrl:'https://example.invalid',deepseekModelName:'test'}
 const adapter=createAgentLlmProvider({config,http:async(_url,init)=>{requests.push(JSON.parse(init.body));return {ok:true,status:200,text:async()=>JSON.stringify({choices:[{finish_reason:'stop',message:{content:requests.length===1?'not JSON':'{"accepted":true}',reasoning_content:'{"accepted":false}'}}]})}}})
 const result=await new ProductTools(adapter,{}).structured(ctx,'formal','fixed prompt',{},value=>{assert.equal(value.accepted,true);return value},1000)
 assert.equal(result.accepted,true);assert.equal(requests.length,2);assert.equal(requests[0].messages[0].content,requests[1].messages[0].content);assert.deepEqual(requests[0].thinking,requests[1].thinking)
})
test('search merging keeps semantic URL parameters and reuses raw evidence on a merge-version change',async t=>{
 const store=await fixture(t),ctx=await context(store),item=(id,url)=>({evidenceId:id,title:id,url,summary:'evidence',authorId:null,authorName:null,authorUrl:null});let calls=0
 const tools=new ProductTools({}, {search:async()=>{calls++;return {kind:'hits',items:[item('a','https://example.invalid/read?id=a')]}},globalSearch:async()=>{calls++;return {kind:'hits',items:[item('b','https://example.invalid/read?id=b'),item('track','https://example.invalid/read?id=a&utm_campaign=x')]}}})
 const result=await tools.search(ctx,'search','topic',{kind:'web'});assert.deepEqual(result.map(x=>x.evidenceId),['a','b']);await tools.search(ctx,'search','topic',{kind:'web'});assert.equal(calls,2)
})
for(const [name,verify] of Object.entries(platformCases))test(name,async t=>verify((await fixture(t)).db))

test('actual author flow repairs overlong questions, then dispatches the shared two groups without loss',async t=>{
 const store=await fixture(t),state={version:2,routeId:'route',conceptId:'concept',title:'概念',description:'范围',hasDispute:false,initialized:true,phase:'ready',active:'conversation',conversations:[{id:'conversation',title:'会话',date:'2026-09-08',messages:[]}],articles:[{id:'article',title:'材料',summary:'来源内容',author:'来源',authorId:null,likes:null,topic:'概念',sourceKind:'upload'}],nodes:[{id:'root',type:'root',title:'概念',text:'',parents:[],sources:[]},{id:'article',type:'article',title:'材料',text:'来源内容',parents:['root'],sources:['article']}]}
 const r=await store.create('owner','learning','author-query',state),queries=['甲'.repeat(90),'乙'.repeat(90),'丙'.repeat(90)],requests=[],sent=[]
 const tools=new ProductTools({complete:async input=>{requests.push(input);return {kind:'completed',text:JSON.stringify({queries:requests.length===1?['甲'.repeat(20),'乙'.repeat(150),'丙'.repeat(150)]:queries})}}},{search:async q=>{sent.push(q);return {kind:'empty'}},direct:async()=>({kind:'completed',text:'正常零位后的直接解释'})})
 await store.enqueue('owner',r.id,'learning.author','author-query',{depth:'fast',conversationId:'conversation',context:replyInput(state,'解释这个问题',['article'],'conversation'),excludedAuthorIds:[]})
 await createFlows(tools)(new TaskContext(store,await store.claim(),new AbortController().signal))
 assert.equal(requests.length,2);assert.equal(requests[0].messages[0].content,requests[1].messages[0].content)
 assert.deepEqual(sent,[queries[0]+' '+queries[1],queries[2]])
 const result=await store.snapshot('owner',r.id);assert.equal(result.job.status,'completed');assert.equal(result.data.nodes.at(-1).origin,'direct')
})
