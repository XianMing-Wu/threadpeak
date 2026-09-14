import {buildPathDocument} from '../../src/pathDocument.ts'
import {placeAnswer} from '../../tests/fixtures/card-answer.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp,rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabase,migrate } from './database.ts'
import { DurableStore, CommandError } from './store.ts'
import { TaskContext, DurableWorker, ToolError } from './worker.ts'
import { validateTree } from '@threadpeak/contracts/learning-v2'
import { readCompletionStream,createAgentLlmProvider } from '../agent-runtime/llm-provider.ts'
import { ProductTools } from './tools.ts'
import { createFlows } from './flows.ts'
import { createProductApp } from './http.ts'
import { verifyIdentityToken } from './auth.ts'

async function fixture(t,directory){const db=await openDatabase({directory});await migrate(db);t.after(()=>db.close());return new DurableStore(db)}
const quiet=()=>{}
test('durable command deduplication, owner isolation and atomic rollback',async t=>{
  const store=await fixture(t),resource=await store.create('alice','test','scope',{nodes:[]})
  const jobs=await Promise.all(Array.from({length:4},()=>store.enqueue('alice',resource.id,'test','same-command',{q:'x'})))
  assert.equal(new Set(jobs.map(j=>j.id)).size,1)
  await assert.rejects(store.enqueue('alice',resource.id,'test','same-command',{q:'y'}),e=>e.code==='COMMAND_CONFLICT')
  await assert.rejects(store.snapshot('bob',resource.id),e=>e.status===404)
  const job=await store.claim()
  await assert.rejects(store.commit(job,()=>{throw new Error('simulated crash before commit')}))
  assert.deepEqual((await store.snapshot('alice',resource.id)).data,{nodes:[]})
  await store.commit(job,()=>({nodes:['one']}))
  await assert.rejects(store.commit(job,()=>({nodes:['duplicate']})),e=>e.code==='LEASE_LOST')
  const events=await store.events('alice',resource.id,0)
  assert.deepEqual(events.map(e=>e.sequence),[1,2]);assert.equal(events.at(-1).kind,'job.completed')
})
test('process restart resumes completed checkpoints without repeating provider work',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'tp-durable-'))
  let db=await openDatabase({directory});await migrate(db);let clock=Date.now();let store=new DurableStore(db,()=>clock)
  try{
    const resource=await store.create('owner','test','scope',{})
    await store.enqueue('owner',resource.id,'test','command',{})
    const first=await store.claim(20)
    await store.checkpoint(first,'search','hash',{evidence:'real-result'})
    await db.close();db=await openDatabase({directory});store=new DurableStore(db,()=>clock);clock+=100
    const resumed=await store.claim();assert.equal(resumed.id,first.id);assert.equal(resumed.fence,first.fence+1)
    assert.deepEqual(resumed.checkpoints.search.value,{evidence:'real-result'})
    await assert.rejects(store.commit(first,()=>({wrong:true})),e=>e.code==='LEASE_LOST')
    await store.commit(resumed,()=>({restored:true}))
    assert.equal((await store.snapshot('owner',resource.id)).data.restored,true)
  }finally{await db.close();await rm(directory,{recursive:true,force:true})}
})
test('cancel wins over a late response; complete wins over a late cancel',async t=>{
  const s=await fixture(t),r=await s.create('owner','test','scope',{})
  await s.enqueue('owner',r.id,'test','command',{});const job=await s.claim()
  await s.cancel('owner',r.id);await assert.rejects(s.commit(job,()=>({wrong:true})),e=>e.code==='LEASE_LOST')
  assert.equal((await s.snapshot('owner',r.id)).job.status,'cancelled')
  await s.enqueue('owner',r.id,'test','command-2',{});const next=await s.claim();await s.commit(next,()=>({ok:true}));await s.cancel('owner',r.id)
  assert.equal((await s.snapshot('owner',r.id)).job.status,'completed')
})
test('interrupted stream and reasoning-only content cannot be committed as a reply',async()=>{
  const encoder=new TextEncoder(),input={messages:[],thinkingDepth:'fast',json:false}
  const partial=new ReadableStream({start(c){c.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"半截正文"}}]}\n\n'));c.close()}})
  await assert.rejects(readCompletionStream(partial,input),/STREAM_INCOMPLETE/)
  const config={deepseekBaseUrl:'https://example.com/v1',deepseekModelName:'configured',deepseekApiKey:'test'}
  const provider=createAgentLlmProvider({config,http:async url=>{assert.equal(url,'https://example.com/v1/chat/completions');return {ok:true,status:200,text:async()=>JSON.stringify({choices:[{finish_reason:'stop',message:{content:'',reasoning_content:'仅供模型思考'}}]})}}})
  assert.equal((await provider.complete(input)).kind,'failed')
  const complete=new ReadableStream({start(c){for(const x of ['data: {"choices":[{"delta":{"content":"完整正文"}}]}\n\n','data: {"choices":[{"finish_reason":"stop","delta":{}}]}\n\n','data: [DONE]\n\n'])c.enqueue(encoder.encode(x));c.close()}})
  assert.equal((await readCompletionStream(complete,input)).content,'完整正文')
})
test('JSON completions require formal content in both streaming and non-streaming responses',async()=>{
 const config={deepseekBaseUrl:'https://example.com/v1',deepseekModelName:'configured',deepseekApiKey:'test'},encoder=new TextEncoder()
 for(const streaming of [false,true])for(const content of ['',JSON.stringify({answer:'正式答案'})]){
  const reasoning=JSON.stringify({answer:'未提交的思考'})
  const provider=createAgentLlmProvider({config,http:async()=>({ok:true,status:200,text:async()=>JSON.stringify({choices:[{finish_reason:'stop',message:{content,reasoning_content:reasoning}}]}),...(streaming?{body:new ReadableStream({start(c){c.enqueue(encoder.encode('data: '+JSON.stringify({choices:[{delta:{content,reasoning_content:reasoning},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n'));c.close()}})}:{})})})
  const result=await provider.complete({messages:[],thinkingDepth:'deep',json:true,...(streaming?{onText:()=>{}}:{})})
  assert.equal(result.kind,content?'completed':'failed')
  if(content)assert.equal(JSON.parse(result.text).answer,'正式答案')
 }
})
test('tree forbids multi-parent, cycles and a mismatched paragraph basis',()=>{
  const root={id:'root',type:'root',parents:[],sources:[],title:'概念',text:''},a={id:'a',type:'article',parents:['root'],sources:['a'],title:'文章',text:''}
  assert.throws(()=>validateTree([root,a,{...a,id:'b',type:'answer',parents:['root','a']}]),/INVALID_PARENT/)
  assert.throws(()=>validateTree([root,a,{...a,id:'b',type:'answer',parents:['a'],basisId:'root'}]),/INVALID_BASIS/)
})
function modelForLearning(calls){return {async complete(input){
  const system=input.messages[0].content,context=JSON.parse(input.messages[1].content);calls.push(system)
  let result
  if(system.includes('首次概念教学'))result={queries:['线性映射解释','线性映射应用','线性映射误区']}
  else if(system.includes('逐条阅读'))result={evidenceIds:context.candidates.map(e=>e.evidenceId)}
  else if(context.citationCatalog)result=placeAnswer(context)
  else if(context.read_card_scope)result={sections:[{after:context.read_card_scope.cards[0].ref,title:'解释',text:'基于这张卡的完整回答。'}]}
  else throw new Error('Unexpected model task')
  if(context.mode==='first_learning'&&result.sections)result.sourceReview=context.read_card_scope.cards.map((c,i)=>({ref:c.ref,contribution:i===0?'用于讲解':'内容重复'}))
  return {kind:'completed',text:JSON.stringify(result)}
}}}
test('real HTTP composition with isolated providers: three searches, persisted tree, new chat, node editing',async t=>{
  const store=await fixture(t),calls=[],searches=[]
  const zhihu={async search(q){searches.push(q);return {kind:'hits',items:[{evidenceId:'article-1',authorId:'author-1',authorName:'测试作者',title:'线性映射说明',summary:'完整 API 总结。'.repeat(400),url:'https://www.zhihu.com/question/1/answer/2'}]}},async direct(){assert.equal(searches.length,3);return {kind:'completed',text:'不同角度的完整材料。'}}}
  const tools=new ProductTools(modelForLearning(calls),zhihu),handler=createFlows(tools),worker=new DurableWorker(store,handler,1,quiet)
  const app=await createProductApp({store,worker,providersReady:true,identity:{production:false}});t.after(()=>app.close())
  const session=await app.inject({method:'POST',url:'/api/auth/guest'}),cookie=String(session.headers['set-cookie']).split(';')[0],headers={cookie}
  const owner=(await store.db.query('SELECT owner_id FROM tp_sessions'))[0].owner_id
  await store.create(owner,'path','published',{status:'published',document:{id:'route-doc'},route:{concepts:[{id:'concept',title:'线性映射',detailedDescription:'理解概念',hasDispute:false}]}})
  const enter=await app.inject({method:'POST',url:'/api/v2/learning/enter',headers,payload:{routeId:'route-doc',conceptId:'concept'}})
  assert.equal(enter.statusCode,200);const id=enter.json().id
  // HTTP starts the worker. Wait for observable completion, not a simulated UI timer.
  for(let i=0;i<200;i++){const snapshot=await store.snapshot(owner,id);if(snapshot.job?.status==='completed')break;await new Promise(r=>setTimeout(r,10))}
  let snapshot=await store.snapshot(owner,id)
  assert.equal(snapshot.job.status,'completed');assert.equal(searches.length,3);assert.equal(snapshot.data.nodes.length,3)
  assert.equal(snapshot.data.articles[0].summary.length,zhihu?400*'完整 API 总结。'.length:0)
  validateTree(snapshot.data.nodes)
  const original=snapshot.data.articles[0].summary
  const modified=snapshot.data.nodes.map(n=>n.id==='article-1'?{...n,text:'用户修改的副本'}:n)
  const edit=await app.inject({method:'PATCH',url:`/api/v2/learning/${id}/nodes`,headers,payload:{revision:snapshot.revision,nodes:modified}})
  assert.equal(edit.statusCode,200);assert.equal(edit.json().data.articles[0].summary,original)
  const baseNode=snapshot.data.nodes.find(n=>n.id==='article-1')
  const patch={baseNodes:[baseNode],nodes:[{...baseNode,color:'#123456'}]}
  const incremental=await app.inject({method:'PATCH',url:`/api/v2/learning/${id}/nodes`,headers,payload:{revision:snapshot.revision,patch}})
  assert.equal(incremental.statusCode,200);assert.equal(incremental.json().data.nodes.find(n=>n.id==='article-1').text,'用户修改的副本');assert.equal(incremental.json().data.nodes.find(n=>n.id==='article-1').color,'#123456')
  const conflict=await app.inject({method:'PATCH',url:`/api/v2/learning/${id}/nodes`,headers,payload:{revision:snapshot.revision,patch:{baseNodes:[baseNode],nodes:[{...baseNode,text:'竞争编辑'}]}}})
  assert.equal(conflict.statusCode,409);assert.equal(conflict.json().code,'NODE_EDIT_CONFLICT')
  const forged=await app.inject({method:'PATCH',url:`/api/v2/learning/${id}/nodes`,headers,payload:{revision:snapshot.revision,patch:{baseNodes:[baseNode],nodes:[{...baseNode,id:'forged'}]}}})
  assert.equal(forged.statusCode,409)
  const fresh=await app.inject({method:'POST',url:`/api/v2/learning/${id}/commands`,headers,payload:{kind:'new-conversation',conversationId:'new-chat'}})
  assert.equal(fresh.statusCode,200);assert.equal(fresh.json().data.nodes.length,3);assert.equal(fresh.json().data.conversations.at(-1).messages.length,0)
  const replay=await app.inject({method:'POST',url:'/api/v2/learning/enter',headers,payload:{routeId:'route-doc',conceptId:'concept'}})
  assert.equal(replay.json().data.active,'new-chat');assert.equal(searches.length,3)
})

import { settledParallel } from './worker.ts'
import { boundedSummary,packContext,tokenBound } from './context.ts'
import { paragraphDraft } from './stream-draft.ts'
import { mergeNodeEdits } from '@threadpeak/contracts/node-edits'
import { withPermit } from './limits.ts'
import { createHmac } from 'node:crypto'

test('a failed parallel branch waits for successful siblings to persist before retry',async t=>{
  const s=await fixture(t),r=await s.create('owner','test','branches',{})
  await s.enqueue('owner',r.id,'test','parallel-command',{})
  const first=await s.claim(),ctx=new TaskContext(s,first,new AbortController().signal)
  await assert.rejects(settledParallel([
    ctx.step('a',{},async()=>{throw new ToolError('RATE_LIMITED')}),
    ctx.step('b',{},async()=>{await new Promise(r=>setTimeout(r,30));return 'saved-search'}),
  ]),e=>e.code==='RATE_LIMITED')
  await s.recover(first,'RATE_LIMITED',false)
  await s.resume('owner',r.id);const second=await s.claim(),again=new TaskContext(s,second,new AbortController().signal)
  assert.equal(await again.step('b',{},()=>{throw Error('must not repeat search')}),'saved-search')
})

test('long context reads every chunk, preserves IDs/questions and reuses owner-scoped memory',async t=>{
  const s=await fixture(t),r=await s.create('owner','test','context',{})
  await s.enqueue('owner',r.id,'test','context-command',{depth:'deep'});const job=await s.claim(),ctx=new TaskContext(s,job,new AbortController().signal)
  const seen=[],llm={async complete(input){assert.equal(input.thinkingDepth,'deep');const data=JSON.parse(input.messages[1].content);seen.push(data.text);return {kind:'completed',text:'包含否定和限制的测试摘要。'}}}
  const original={currentQuestion:'这一句必须完整保留？',allowedCards:[{id:'source-1',title:'原始标题',content:'内容'.repeat(30000)+'尾部重要限制'}],conversation:[]}
  const before=structuredClone(original),messages=await packContext(llm,ctx,'固定系统',original,'deep',{window:32000,output:4096,margin:2048})
  assert.ok(tokenBound(JSON.stringify(messages))<32000);const packed=JSON.parse(messages[1].content)
  assert.equal(packed.currentQuestion,original.currentQuestion);assert.equal(packed.allowedCards[0].id,'source-1');assert.deepEqual(original,before)
  assert.ok(seen.some(text=>text.includes('尾部重要限制')))
  const source='原始内容'.repeat(500),target=800
  await boundedSummary(llm,ctx,source,'same-source',target,'deep',32000);const calls=seen.length
  await s.commit(job,()=>({}))
  await s.enqueue('owner',r.id,'test','next-memory-job',{depth:'deep'});const next=await s.claim()
  await boundedSummary(llm,new TaskContext(s,next,new AbortController().signal),source,'same-source',target,'deep',32000)
  assert.equal(seen.length,calls)
  assert.equal((await s.db.query('SELECT * FROM tp_memories WHERE owner_id=$1',['another-owner'])).length,0)
})

test('summary provider failure does not produce a prefix or alter the original',async t=>{
  const s=await fixture(t),r=await s.create('owner','test','summary-failure',{})
  await s.enqueue('owner',r.id,'test','summary-failure-command',{});const job=await s.claim(),ctx=new TaskContext(s,job,new AbortController().signal)
  await assert.rejects(boundedSummary({complete:async()=>({kind:'failed',code:'RATE_LIMITED',retryable:true})},ctx,'很长的内容'.repeat(1000),'source',600,'fast',32000),e=>e.code==='RATE_LIMITED')
  assert.equal((await s.db.query('SELECT * FROM tp_memories')).length,0)
})

test('local structure recovery preserves single-card scope; drafts are presentation only',async t=>{
  const s=await fixture(t),r=await s.create('owner','test','repair',{})
  await s.enqueue('owner',r.id,'test','repair-command',{depth:'deep'});const job=await s.claim(),ctx=new TaskContext(s,job,new AbortController().signal),calls=[]
  const llm={complete:async input=>{calls.push(input);const context=JSON.parse(input.messages[1].content);const raw=JSON.stringify(context.citationCatalog?placeAnswer(context):{sections:[{after:calls.length===1?'C9':'C1',title:'解释',text:'引用这一张卡。'}]});input.onText?.(raw);return {kind:'completed',text:raw}}}
  const tools=new ProductTools(llm,{})
  const result=await tools.answerCards(ctx,{allowedCards:[{id:'allowed',title:'卡片',content:'资料'}]})
  await ctx.flush();assert.equal(result.paragraphs[0].basisId,'allowed');assert.equal(calls.length,2)
  assert.ok(calls.every(c=>c.thinkingDepth==='deep'));assert.match(result.paragraphs[0].text,/资料/)
  assert.equal((await s.snapshot('owner',r.id)).job.status,'running');assert.deepEqual((await s.snapshot('owner',r.id)).data,{})
  assert.equal(paragraphDraft('{"paragraphs":[{"basisId":"secret-id","text":"一句\\n话"},{"text":"第二段'), '一句\n话\n\n第二段')
})

test('three-way node edits retain independent edits and concurrent additions; same-field conflicts block',()=>{
  const root={id:'root',type:'root',title:'根',text:'',parents:[],sources:[]},a={id:'a',type:'custom',title:'原名',text:'原文',parents:['root'],sources:[]},b={...a,id:'b',title:'并发添加'}
  const merged=mergeNodeEdits([root,a],[root,{...a,title:'我的标题'}],[root,{...a,color:'#ffffff'},b])
  assert.equal(merged[1].title,'我的标题');assert.equal(merged[1].color,'#ffffff');assert.equal(merged[2].id,'b')
  assert.throws(()=>mergeNodeEdits([root,a],[root,{...a,text:'我的编辑'}],[root,{...a,text:'另一处编辑'}]),/NODE_EDIT_CONFLICT/)
  assert.throws(()=>mergeNodeEdits([root,a],[root],[root,{...a,text:'刚修改'}]),/NODE_EDIT_CONFLICT/)
})

test('provider permits bound concurrent calls and release after failure',async t=>{
  const s=await fixture(t);let active=0,maximum=0,done=0
  const jobs=Array.from({length:7},(_,i)=>withPermit(s.db,'test-provider',2,undefined,async()=>{active++;maximum=Math.max(active,maximum);try{await new Promise(r=>setTimeout(r,25));if(i===2)throw Error('provider failed');done++}finally{active--}}))
  await Promise.allSettled(jobs);assert.equal(maximum,2);assert.equal(done,6)
  assert.equal((await s.db.query("SELECT * FROM tp_provider_slots WHERE pool='test-provider' AND token IS NOT NULL")).length,0)
})

test('production identity rejects unsigned, expired and wrong-audience tokens; resources stay isolated',()=>{
  const config={production:true,jwtSecret:'s'.repeat(40),issuer:'https://identity.example',audience:'threadpeak'}
  const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url')
  const token=payload=>{const data=encode({alg:'HS256',typ:'JWT'})+'.'+encode(payload);return data+'.'+createHmac('sha256',config.jwtSecret).update(data).digest('base64url')}
  const body={iss:config.issuer,aud:config.audience,sub:'alice',exp:Math.floor(Date.now()/1000)+600}
  assert.match(verifyIdentityToken(token(body),config),/^account:/)
  assert.notEqual(verifyIdentityToken(token(body),config),verifyIdentityToken(token({...body,sub:'bob'}),config))
  assert.throws(()=>verifyIdentityToken(token({...body,exp:0}),config));assert.throws(()=>verifyIdentityToken(token({...body,aud:'another-product'}),config));assert.throws(()=>verifyIdentityToken(token(body)+'bad',config))
})

async function settled(s,owner,id){const deadline=Date.now()+30_000;while(Date.now()<deadline){const value=await s.snapshot(owner,id);if(!['queued','running'].includes(value.job?.status??''))return value;await new Promise(r=>setTimeout(r,10))}throw Error('test task did not settle')}
test('route selection survives refresh and R4 recovery publishes exactly once without repeating searches',async t=>{
  const s=await fixture(t),calls=[],searches=[];let failR4=true
  const r1={queries:[{id:'q1',text:'入门课程推荐',purpose:'发现入门载体',angle:'normal_learning'},{id:'q2',text:'测试入门',purpose:'发现入门载体',angle:'normal_learning'},{id:'q3',text:'先学基础有必要吗',purpose:'发现选择差异',angle:'pitfall_or_dispute'},{id:'q4',text:'不同方法适合谁',purpose:'发现选择差异',angle:'pitfall_or_dispute'}]}
  const r3={round:1,status:'active',questions:[1,2].map(i=>({id:'q'+i,prompt:'目标 '+i,options:[{id:'a',label:'先看例子',routeEffect:'examples'},{id:'b',label:'先看定义',routeEffect:'definitions'}]}))}
  const r4={version:'1.0',routeId:'test-route',title:'测试路线',carriers:[{id:'c',title:'测试载体',description:'基础'}],concepts:[{id:'n',carrierId:'c',title:'测试概念',hasDispute:false,detailedDescription:'讲解',attachmentSourceIds:[]}],carrierEdges:[],conceptEdges:[],entryConceptIds:['n'],terminalConceptIds:['n']}
  const fixtureTools={planStep:async(ctx,id,input)=>ctx.step(id,input,async()=>{calls.push(id);if(id==='R4'&&failR4){failR4=false;throw new ToolError('TEMPORARY_GATE',false)}if(id==='R4'){assert.equal(input.questionSets[0].selectedOptions.length,2);assert.equal(input.questionSets[0].selectedOptions[1].routeEffect,'definitions')}return {R1:r1,R2:{测试载体:{测试概念:{争议:false}}},R3:r3,R4:r4}[id]}),search:async(ctx,name,q)=>ctx.step(name,{q},async()=>{searches.push(q);return []})}
  fixtureTools.catalogNames=async()=>({carriers:[]});fixtureTools.catalogSearches=async()=>[];fixtureTools.routeInterview=(ctx,input)=>fixtureTools.planStep(ctx,'R3',input)
  fixtureTools.routePlan=(ctx,input)=>fixtureTools.planStep(ctx,'R4',input)
  const worker=new DurableWorker(s,createFlows(fixtureTools),1,quiet),app=await createProductApp({store:s,worker,providersReady:true,identity:{production:false}});t.after(()=>app.close())
  const cookie=String((await app.inject({method:'POST',url:'/api/auth/guest'})).headers['set-cookie']).split(';')[0],headers={cookie,'idempotency-key':'route-request'},owner=(await s.db.query('SELECT owner_id FROM tp_sessions'))[0].owner_id
  const started=await app.inject({method:'POST',url:'/api/path-runs',headers,payload:{goal:'测试路线'}}),id=started.json().runId
  let snapshot=await settled(s,owner,id);assert.equal(snapshot.data.questionSets.length,1)
  const questions=snapshot.data.questionSets[0].questions
  for(let i=0;i<questions.length;i++){
    const payload={questionId:questions[i].id,optionId:questions[i].options[i].id},head={cookie,'idempotency-key':'answer-request-'+i}
    const response=await app.inject({method:'POST',url:`/api/path-runs/${id}/select`,headers:head,payload});assert.equal(response.statusCode,200)
    const duplicate=await app.inject({method:'POST',url:`/api/path-runs/${id}/select`,headers:head,payload});assert.equal(duplicate.statusCode,200)
    snapshot=await settled(s,owner,id)
  }
  assert.equal(snapshot.job.status,'waiting');assert.equal(snapshot.data.conversation.filter(m=>m.messageId.startsWith('choice-')).length,2)
  const refreshed=await app.inject({url:`/api/path-runs/${id}`,headers:{cookie}});assert.equal(Object.keys(refreshed.json().questionSets[0].selectedOptionIds).length,2)
  await app.inject({method:'POST',url:`/api/v2/resources/${id}/resume`,headers:{cookie},payload:{}})
  snapshot=await settled(s,owner,id);assert.equal(snapshot.job.status,'completed');assert.equal(snapshot.data.status,'published');assert.equal(searches.length,2)
  assert.equal(calls.filter(c=>c==='R1').length,1);assert.equal(calls.filter(c=>c==='R4').length,2)
  assert.equal((await s.list(owner,'learning')).length,0)
})

test('learning command replay, empty author evidence, undo provenance and active-history switch are transactional',async t=>{
  const s=await fixture(t),seen=[]
  const zhihu={search:async()=>({kind:'empty'}),direct:async()=>({kind:'completed',text:'刘看山补充解释。'})}
  const llm={complete:async input=>{const system=input.messages[0].content,context=JSON.parse(input.messages[1].content);seen.push(context);return {kind:'completed',text:JSON.stringify(system.includes('已有的公开回答')?{queries:['测试问题的解释','测试问题的误区']}:context.citationCatalog?placeAnswer(context):{sections:[{after:'C1',title:'回答',text:'依据卡片的回答。'}]})}}}
  const worker=new DurableWorker(s,createFlows(new ProductTools(llm,zhihu)),1,quiet),app=await createProductApp({store:s,worker,providersReady:true,identity:{production:false}});t.after(()=>app.close())
  const cookie=String((await app.inject({method:'POST',url:'/api/auth/guest'})).headers['set-cookie']).split(';')[0],owner=(await s.db.query('SELECT owner_id FROM tp_sessions'))[0].owner_id,headers={cookie}
  const article={id:'a',title:'测试文章',summary:'全部资料',author:'测试作者',authorId:'author-a',likes:null,url:'https://www.zhihu.com/question/1',topic:'测试'}
  const root={id:'root',type:'root',title:'概念',text:'',parents:[],sources:['a']},node={id:'a',type:'article',title:'测试文章',text:'全部资料',parents:['root'],sources:['a']}
  const state={version:2,routeId:'r',conceptId:'c',title:'概念',description:'描述',hasDispute:false,initialized:true,phase:'ready',articles:[article],nodes:[root,node],active:'new',conversations:[{id:'old',title:'历史',date:'today',messages:[{id:'old-question',role:'user',text:'不应进入新上下文的旧问题'}]},{id:'new',title:'新对话',date:'today',messages:[]}]}
  const resource=await s.create(owner,'learning','test-learning',state),id=resource.id
  const payload={kind:'reply',question:'请解释',selected:['a'],conversationId:'new'},key={...headers,'idempotency-key':'learning-request'}
  assert.equal((await app.inject({method:'POST',url:`/api/v2/learning/${id}/commands`,headers:key,payload})).statusCode,200)
  let snapshot=await settled(s,owner,id)
  assert.equal((await app.inject({method:'POST',url:`/api/v2/learning/${id}/commands`,headers:key,payload})).statusCode,200)
  assert.equal(seen.length,2);assert.equal(seen[0].conversation.length,0);assert.equal(snapshot.data.conversations[1].messages.length,2)
  const originalNodes=snapshot.data.nodes
  let response=await app.inject({method:'PATCH',url:`/api/v2/learning/${id}/nodes`,headers,payload:{revision:snapshot.revision,nodes:originalNodes.slice(0,2)}});assert.equal(response.statusCode,200)
  response=await app.inject({method:'PATCH',url:`/api/v2/learning/${id}/nodes`,headers,payload:{revision:response.json().revision,nodes:originalNodes}});assert.equal(response.statusCode,200)
  response=await app.inject({method:'PATCH',url:`/api/v2/learning/${id}/nodes`,headers,payload:{revision:response.json().revision,nodes:[...originalNodes,{...originalNodes[2],id:'forged-model-answer'}]}});assert.equal(response.statusCode,409)
  await app.inject({method:'POST',url:`/api/v2/learning/${id}/commands`,headers,payload:{kind:'author',question:'找其他解读',selected:['a'],conversationId:'new'}})
  await app.inject({method:'POST',url:`/api/v2/learning/${id}/commands`,headers,payload:{kind:'activate-conversation',conversationId:'old'}})
  snapshot=await settled(s,owner,id);assert.equal(snapshot.job.status,'completed');assert.equal(snapshot.data.active,'old');assert.equal(snapshot.data.nodes.length,originalNodes.length)
  assert.equal((await s.db.query('SELECT * FROM tp_author_network')).length,0)
  const unauth=await app.inject({url:`/api/v2/resources/${id}`});assert.equal(unauth.statusCode,401)
  const cross=await app.inject({method:'POST',url:`/api/v2/resources/${id}/cancel`,headers:{...headers,'sec-fetch-site':'cross-site'},payload:{}});assert.equal(cross.statusCode,403)
})

test('unrepairable math stays readable verbatim without inventing a different expression',async t=>{
  const s=await fixture(t),r=await s.create('owner','test','math-repair',{});await s.enqueue('owner',r.id,'test','math-repair-command',{depth:'deep'});const job=await s.claim(),ctx=new TaskContext(s,job,new AbortController().signal),calls=[]
  const llm={complete:async input=>{calls.push(input);return {kind:'completed',text:calls.length===1?String.raw`结果 $\unknownMacro{x}$。`:String.raw`结果 $\frac{x}{2}$。`}}}
  const result=await new ProductTools(llm,{}).chat(ctx,{currentMessage:'解释这个式子',conversation:[]})
  assert.match(result,/unknownMacro/);assert.doesNotMatch(result,/frac/);assert.equal(calls.length,1);assert.ok(calls.every(c=>c.thinkingDepth==='deep'))
  assert.deepEqual((await s.snapshot('owner',r.id)).data,{})
})

test('route progress and library use resource identity when old documents share an id',async t=>{
  const store=await fixture(t),worker=new DurableWorker(store,async()=>{},1,quiet)
  const app=await createProductApp({store,worker,providersReady:true,identity:{production:false}});t.after(()=>app.close())
  const cookie=String((await app.inject({method:'POST',url:'/api/auth/guest'})).headers['set-cookie']).split(';')[0],headers={cookie}
  const owner=(await store.db.query('SELECT owner_id FROM tp_sessions'))[0].owner_id
  const body={status:'published',goal:'route',document:buildPathDocument({id:'legacy-doc',title:'route',description:'goal',goalTitle:'done',goalSummary:'goal',carriers:[{id:'carrier',title:'part',summary:'part',concepts:[['concept','concept','body']]}]}),progress:'position-one'}
  const one=await store.create(owner,'path','scope-one',body),two=await store.create(owner,'path','scope-two',{...body,progress:'position-two'})
  const library=(await app.inject({url:'/api/v2/library',headers})).json()
  assert.deepEqual(new Set(library.conversations.map(c=>c.routeId)),new Set([one.id,two.id]))
  assert.equal((await app.inject({url:`/api/v2/paths/${one.id}/progress`,headers})).json().value,'position-one')
  assert.equal((await app.inject({url:`/api/v2/paths/${two.id}/progress`,headers})).json().value,'position-two')
  assert.equal((await app.inject({url:'/api/v2/paths/legacy-doc/progress',headers})).statusCode,404)
  assert.equal((await app.inject({method:'PUT',url:`/api/v2/paths/${one.id}/progress`,headers,payload:{value:'changed-one'}})).statusCode,200)
  assert.equal((await store.resource(owner,two.id)).body.progress,'position-two')
  const foreign=String((await app.inject({method:'POST',url:'/api/auth/guest'})).headers['set-cookie']).split(';')[0]
  assert.equal((await app.inject({url:`/api/v2/paths/${one.id}/progress`,headers:{cookie:foreign}})).statusCode,404)
})

test('local recovery fixes wrong evidence before chat/tree commit and never reuses the old batch checkpoint',async t=>{
  const s=await fixture(t),r=await s.create('owner','test','citation-repair',{})
  await s.enqueue('owner',r.id,'test','citation-command',{depth:'deep'});const job=await s.claim(),ctx=new TaskContext(s,job,new AbortController().signal),calls=[]
  job.checkpoints['L-answer:cards-v1']={hash:'old-contract',value:{operations:[{tool:'append_cards',after:'C1',cards:[{title:'错引',text:'词源'}]}]}}
  const llm={complete:async input=>{
    calls.push(input);const context=JSON.parse(input.messages[1].content)
    if(context.candidate_card_scope)return {kind:'completed',text:JSON.stringify({selections:[{ref:'C2',reason:'词源'}]})}
    return {kind:'completed',text:JSON.stringify(context.citationCatalog?{placements:[{section:'P1',after:'C1',evidenceRefs:['C2.E2']}]}:{sections:[{after:'C1',title:'词源',text:'代数一词来自 al-jabr，表示还原。'}]})}
  }}
  const answer=await new ProductTools(llm,{}).answerCards(ctx,{allowedCards:[{id:'school',title:'课本',content:'包括代数和几何。'},{id:'history',title:'词源',content:'al-jabr 表示还原。'}]})
  assert.equal(answer.paragraphs[0].basisId,'history');assert.equal(calls.length,3)
  assert.match(job.checkpoints['diagnostic:L-answer:attach-v4:recovery'].value.reason,/不在 C1/);assert.equal(calls[1].thinkingDepth,'deep')
  assert.equal(Object.entries(job.checkpoints).find(([key])=>key.startsWith('L-answer:compose-v4@goal-v1:'))[1].value.answer.sections[0].after,'C1')
  assert.deepEqual((await s.snapshot('owner',r.id)).data,{})
})
test('citation evidence uses the delivered compressed material version without relabelling it as original',async t=>{
  const s=await fixture(t),r=await s.create('owner','test','citation-summary',{})
  await s.enqueue('owner',r.id,'test','citation-summary-command',{});const job=await s.claim(),ctx=new TaskContext(s,job,new AbortController().signal)
  let modelView
  const llm={complete:async input=>{
    if(!input.json)return {kind:'completed',text:'这份压缩摘要说明变量表示未知数量。'}
    const context=JSON.parse(input.messages[1].content)
    if(context.citationCatalog)return {kind:'completed',text:JSON.stringify(placeAnswer(context))}
    modelView=context.read_card_scope
    return {kind:'completed',text:JSON.stringify({sections:[{after:'C1',title:'变量',text:'变量表示未知数量。'}]})}
  }}
  const original='变量用于表示未知的数量。'.repeat(6000)
  const result=await new ProductTools(llm,{},32000).answerCards(ctx,{allowedCards:[{id:'long-article',title:'变量',content:original}]})
  assert.equal(result.paragraphs[0].basisId,'long-article');assert.match(modelView.cards[0].content,/上下文摘要/)
  assert.match(Object.entries(job.checkpoints).find(([key])=>key.startsWith('L-answer:compose-v4@goal-v1:'))[1].value.view.cards[0].content,/上下文摘要/)
  assert.match(Object.entries(job.checkpoints).find(([key])=>key.startsWith('L-answer:attach-v4@goal-v1:'))[1].value.catalog[0].excerpts[1].text,/上下文摘要/)
})

test('first entry repairs citation batching and mismatched evidence before publishing chat and the single-parent tree',async t=>{
  const s=await fixture(t),articles=[
    {evidenceId:'school-id',title:'课本',summary:'课本分代数和几何。'},
    {evidenceId:'history-id',title:'词源',summary:'al-jabr 表示还原。'},
    {evidenceId:'equation-id',title:'方程',summary:'初等代数的中心内容是解方程。'},
  ].map(a=>({...a,url:`https://www.zhihu.com/question/1/answer/${a.evidenceId}`,authorName:'测试作者',authorId:'test-author'}))
  const initial={version:2,routeId:'route',conceptId:'concept',title:'代数基础',description:'认识代数',hasDispute:false,articles:[],nodes:[],initialized:false,phase:'searching',active:'first',conversations:[{id:'first',title:'代数基础',date:'2026-09-06',messages:[{id:'concept-question',role:'user',text:'代数基础'}]}]}
  const resource=await s.create('owner','learning','citation-first-entry',initial)
  await s.enqueue('owner',resource.id,'learning.enter','citation-first-command',{conversationId:'first',depth:'fast'})
  let answerCalls=0,searches=0
  const history={title:'词源',text:'al-jabr 的含义是还原。'},equation={title:'方程',text:'初等代数围绕解方程展开。'}
  const llm={complete:async input=>{
    const context=JSON.parse(input.messages[1].content),system=input.messages[0].content
    let value
    if(system.includes('首次概念教学'))value={queries:['代数词源','代数基础解释','代数方程']}
    else if(context.candidate_card_scope)value={selections:context.candidate_card_scope.cards.map(c=>({ref:c.ref,reason:'本课依据'}))}
    else if(system.includes('逐条阅读'))value={evidenceIds:articles.map(a=>a.evidenceId)}
    else{
      answerCalls++
      if(context.read_card_scope)assert.deepEqual(context.read_card_scope.cards.map(c=>c.content),articles.map(a=>a.summary))
      const during=(await s.snapshot('owner',resource.id)).data
      assert.equal(during.articles.length,3);assert.equal(during.nodes.length,4);assert.equal(during.conversations[0].messages.length,1)
      value=context.citationCatalog?(answerCalls===3?{placements:[{section:'P1',after:'C2',evidenceRefs:['C1.E2']},{section:'P2',after:'C3',evidenceRefs:['C3.E2']}]}:placeAnswer(context)):
        {sections:answerCalls===1?[{after:'C1',cards:[history,equation]}]:[{after:'C2',...history},{after:'C3',...equation}]}
    }
    if(value.sections)value.sourceReview=context.read_card_scope.cards.map((c,i)=>({ref:c.ref,contribution:['课本分类不属于本次讲解重点','代数词源','方程的核心地位'][i]}))
    return {kind:'completed',text:JSON.stringify(value)}
  }}
  const angles=[]
  const zhihu={search:async()=>{searches++;return {kind:'hits',items:articles}},direct:async input=>{
    const content=input.messages[1].content,context=JSON.parse(content.slice(content.indexOf('\n{')+1))
    assert.deepEqual(context.materials.map(m=>m.content),articles.map(a=>a.summary))
    angles.push(context.angle)
    return {kind:'completed',text:'组织讲解的参考角度，不能冒充文章依据。'}
  }}
  const worker=new DurableWorker(s,createFlows(new ProductTools(llm,zhihu)),1,quiet)
  await worker.execute(await s.claim())
  const snapshot=await s.snapshot('owner',resource.id)
  assert.equal(snapshot.job.status,'completed');assert.equal(searches,3);assert.equal(answerCalls,2)
  assert.deepEqual(angles,[])
  assert.equal(snapshot.data.initialAnswer.length,3);assert.ok(snapshot.data.initialAnswer.every(p=>articles.some(a=>a.evidenceId===p.basisId)))
  const response=snapshot.data.conversations[0].messages[1]
  assert.deepEqual(response.paragraphs,snapshot.data.initialAnswer)
  for(const p of response.paragraphs){const node=snapshot.data.nodes.find(n=>n.id===p.id);assert.deepEqual(node.parents,[p.basisId]);assert.deepEqual(node.sources,[p.basisId])}
  validateTree(snapshot.data.nodes)
})

test('provider preserves malformed outer JSON instead of replacing it with a valid inner fragment',async()=>{
 const content=String.raw`{"sections":[{"after":"C1","title":"例子","text":"公式 \(x\)"},{"after":"C2","title":"第二段","text":"不能丢掉第一段"}]}`
 const config={deepseekBaseUrl:'https://example.com/v1',deepseekModelName:'configured',deepseekApiKey:'test'}
 for(const streaming of [false,true]){
  const payload=JSON.stringify({choices:[{finish_reason:'stop',message:{content}}]})
  const provider=createAgentLlmProvider({config,http:async()=>({ok:true,status:200,text:async()=>payload,...streaming?{body:new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('data: '+JSON.stringify({choices:[{delta:{content},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n'));c.close()}})}:{}})})
  const result=await provider.complete({messages:[],json:true,thinkingDepth:'fast',...streaming?{onText:()=>{}}:{}})
  assert.equal(result.kind,'completed');assert.equal(result.text,content)
 }
})
