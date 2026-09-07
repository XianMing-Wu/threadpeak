import test from 'node:test'
import assert from 'node:assert/strict'
import {openDatabase,migrate} from './database.ts'
import {DurableStore} from './store.ts'
import {TaskContext,DurableWorker,ToolError} from './worker.ts'
import {ProductTools} from './tools.ts'
import {placeAnswer} from '../../tests/fixtures/card-answer.mjs'
import {readCardScope} from '../knowledge/card-tools.ts'
import {citationCatalog,attachComposition} from '../knowledge/answer-composition.ts'
import {boundedSummary} from './context.ts'

const input={allowedCards:[{id:'a',title:'旋转',content:'矩阵作用于向量，得到旋转后的向量。'}],currentQuestion:'用一个例子解释向量和矩阵',goalContext:{rawGoal:'绘制可以旋转的图形'}}
const answer={sections:[{after:'C1',title:'同一个点怎样旋转',text:'我们先取一个点，再用矩阵变换这个点。'}]}
async function fixture(t){const db=await openDatabase();await migrate(db);t.after(()=>db.close());const store=new DurableStore(db);const resource=await store.create('owner','test','continuous',{});await store.enqueue('owner',resource.id,'test','continuous',{depth:'fast'});return {store,resource}}

test('a later source summary has its own running step instead of inheriting a previous completed status',async t=>{
 const {store,resource}=await fixture(t),job=await store.claim(),ctx=new TaskContext(store,job,new AbortController().signal)
 let calls=0;const llm={complete:async()=>{calls++;const activities=(await store.snapshot('owner',resource.id)).job.activities;assert.equal(activities.filter(a=>a.status==='running').length,1);assert.equal(activities.filter(a=>a.status==='done').length,calls-1);return {kind:'completed',text:'保留原始材料中的条件与结论。'}}}
 for(const source of ['first','second'])await boundedSummary(llm,ctx,'原始资料。'.repeat(200),source,512,'fast',64000)
 assert.equal(calls,2);const activities=(await store.snapshot('owner',resource.id)).job.activities
 assert.equal(new Set(activities.map(a=>a.id)).size,2);assert.ok(activities.every(a=>a.status==='done'))
 await boundedSummary(llm,ctx,'原始资料。'.repeat(200),'first',512,'fast',64000);assert.equal(calls,2)
})

test('association retries never replay composition; failure and recovery retain frozen prose and use its checkpoint',async t=>{
 const {store,resource}=await fixture(t);let composeCalls=0,attachCalls=0,fail=true;const prompts=[]
 const tools=new ProductTools({complete:async call=>{
  const data=JSON.parse(call.messages[1].content)
  if(!data.citationCatalog){composeCalls++;assert.equal(data.currentQuestion,input.currentQuestion);const raw=JSON.stringify(answer);call.onText?.(raw);return {kind:'completed',text:raw}}
  attachCalls++;prompts.push(call.messages[0].content);assert.equal(call.thinkingDepth,'fast');assert.equal(call.onText,undefined)
  const snapshot=await store.snapshot('owner',resource.id);assert.match(snapshot.job.draft,/同一个点/);assert.deepEqual(snapshot.data,{})
  return {kind:'completed',text:JSON.stringify(fail?{placements:[{section:'P1',after:'C1',evidenceRefs:['C9.E1']}]}:placeAnswer(data))}
 }},{})
 const worker=new DurableWorker(store,async ctx=>{const result=await tools.answerCards(ctx,input);await ctx.flush();await store.commit(ctx.job,()=>result)},1,()=>{})
 await worker.execute(await store.claim());let snapshot=await store.snapshot('owner',resource.id)
 assert.equal(snapshot.job.status,'waiting');assert.match(snapshot.job.draft,/用矩阵变换/);assert.equal(composeCalls,1);assert.equal(attachCalls,3);assert.equal(new Set(prompts).size,1)
 assert.equal(snapshot.job.activities.find(a=>a.id==='answer:write').status,'done');assert.equal(snapshot.job.activities.find(a=>a.id==='answer:attach').status,'waiting')
 fail=false;await store.resume('owner',resource.id);await worker.execute(await store.claim());snapshot=await store.snapshot('owner',resource.id)
 assert.equal(snapshot.job.status,'completed');assert.equal(composeCalls,1);assert.equal(attachCalls,4);assert.equal(snapshot.data.paragraphs[0].text,answer.sections[0].text)
 const events=await store.events('owner',resource.id,0),drafts=events.filter(e=>e.kind==='job.progress').map(e=>e.payload.draft)
 assert.ok(drafts.length>0);assert.ok(drafts.every(s=>s.trim()));assert.equal(events.filter(e=>e.kind==='job.completed').length,1)
})

test('the last throttled chunk is flushed and phase changes never clear it; late writes lose the cancellation fence',async t=>{
 const {store,resource}=await fixture(t),job=await store.claim(),ctx=new TaskContext(store,job,new AbortController().signal)
 ctx.draft('写作','首段');ctx.draft('写作','首段和最后一个字');await ctx.flush();await ctx.progress('关联来源')
 assert.equal((await store.snapshot('owner',resource.id)).job.draft,'首段和最后一个字')
 ctx.draft('写作','迟到的字');await store.cancel('owner',resource.id)
 await assert.rejects(ctx.flush(),e=>e.code==='LEASE_LOST');assert.equal((await store.snapshot('owner',resource.id)).job.status,'cancelled')
})

test('progress events do not rewrite the resource body, while an actual edit does',async t=>{
 const {store,resource}=await fixture(t),job=await store.claim();const queries=[],query=store.db.query
 // Transactions expose a separate SQL object; observe it without replacing storage.
 const transaction=store.db.transaction;store.db.transaction=fn=>transaction(tx=>fn({...tx,query:async(sql,args)=>{queries.push(sql);return tx.query(sql,args)}}))
 await store.progress(job,'读取');await store.activity(job,{id:'write',kind:'write',title:'写作',status:'running'})
 assert.equal(queries.filter(q=>q.startsWith('UPDATE tp_resources')&&q.includes('body=')).length,0)
 await store.progress(job,'编辑',undefined,r=>({...r.body,edited:true}))
 assert.equal(queries.filter(q=>q.startsWith('UPDATE tp_resources')&&q.includes('body=')).length,1)
 assert.equal((await store.snapshot('owner',resource.id)).data.edited,true)
})

test('issued excerpts preserve every character and cannot bind another source or reorder sections',()=>{
 const scope=readCardScope([{id:'a',title:'A',content:'向量资料。\n'.repeat(1000)},{id:'b',title:'B',content:'矩阵资料。'}]),catalog=citationCatalog(scope.view)
 assert.equal(catalog[0].excerpts.slice(1).map(e=>e.text).join(''),scope.view.cards[0].content)
 assert.ok(catalog.flatMap(c=>c.excerpts).every(e=>e.text.length<=2000))
 const value={sections:[{after:'C1',title:'向量',text:'向量。'},{after:'C2',title:'矩阵',text:'矩阵。'}]}
 const good={placements:[{section:'P1',after:'C1',evidenceRefs:['C1.E2']},{section:'P2',after:'C2',evidenceRefs:['C2.E2']}]}
 assert.deepEqual(attachComposition(scope,value,catalog,good).map(p=>p.basisId),['a','b'])
 for(const bad of [{placements:[...good.placements].reverse()},{placements:[good.placements[0]]},{placements:[{section:'P1',after:'C1',evidenceRefs:['C2.E2']},good.placements[1]]},{placements:[{section:'P1',after:'C1',evidenceRefs:['C1.E999']},good.placements[1]]}])assert.throws(()=>attachComposition(scope,value,catalog,bad))
})

test('rate limiting is persisted on the actual step; recovery keeps completed work and its timestamps',async t=>{
 const {store,resource}=await fixture(t);let calls=0
 const tools=new ProductTools({}, {search:async()=>++calls===1?{kind:'failed',code:'ZHIHU_RATE_LIMITED',retryable:true}:{kind:'hits',items:[]}})
 const worker=new DurableWorker(store,async ctx=>{await tools.search(ctx,'L-search:0','概念');await ctx.flush();await store.commit(ctx.job,()=>({ok:true}))},1,()=>{})
 await worker.execute(await store.claim());let snapshot=await store.snapshot('owner',resource.id)
 assert.equal(snapshot.job.status,'queued');assert.match(snapshot.job.phase,/频率受限/);assert.equal(snapshot.job.activities[0].status,'waiting');assert.match(snapshot.job.activities[0].detail,/知乎请求频率受限/)
 const start=snapshot.job.activities[0].startedAt
 await store.db.query('UPDATE tp_jobs SET next_at=0 WHERE id=$1',[snapshot.job.id]);await worker.execute(await store.claim());snapshot=await store.snapshot('owner',resource.id)
 assert.equal(snapshot.job.status,'completed');assert.equal(snapshot.job.activities[0].status,'done');assert.equal(snapshot.job.activities[0].startedAt,start)
 const job=(await store.db.query('SELECT * FROM tp_jobs WHERE id=$1',[snapshot.job.id]))[0],finished=job.activities[0].finishedAt
 // A resumed checkpoint cannot pretend to finish again at the later clock time.
 assert.ok(finished>=start)
})
