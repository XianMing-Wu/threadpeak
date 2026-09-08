import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {DurableStore} from './store.ts'
import {readLibraryPage} from './library.ts'
import {readStageMetrics} from './ops-metrics.ts'
import {recordMetric} from './metrics.ts'
import {cacheZhihuDirect,instrumentProviders} from './provider-runtime.ts'
import {providerScope} from './provider-scope.ts'
export const platformCases={
 'library keyset pages retain tied IDs, isolate owners and exclude chat bodies':async db=>{
  const owner='audit:'+randomUUID(),store=new DurableStore(db,()=>Date.now()),resources=[]
  for(let i=0;i<5;i++)resources.push(await store.create(owner,'chat',`chat-${i}`,{title:`Chat ${i}`,messages:[{text:'private source'.repeat(20000)}]}))
  await store.create(owner+'other','chat','other',{title:'other'})
  await db.query('UPDATE tp_resources SET updated_at=$2 WHERE owner_id=$1',[owner,123456789])
  const ids=[];let cursor
  do{const page=await readLibraryPage(db,owner,cursor,2);assert.ok(page.conversations.length<=2);assert.ok(!JSON.stringify(page).includes('private source'));ids.push(...page.conversations.map(c=>c.resourceId));cursor=page.nextCursor}while(cursor)
  assert.deepEqual(ids,resources.map(r=>r.id).sort().reverse());assert.equal(new Set(ids).size,5)
  assert.deepEqual((await readLibraryPage(db,owner+'other')).conversations.map(c=>c.title),['other'])
  await assert.rejects(readLibraryPage(db,owner,'broken'),e=>e.code==='INVALID_LIBRARY_CURSOR')
  let projected
  const inspect={...db,query:async(sql,args)=>{const rows=await db.query(sql,args);if(sql.includes('to_jsonb(j)'))projected=rows[0].latest_job;return rows}}
  const lean=new DurableStore(inspect),resource=await store.create(owner,'test','snapshot',{})
  await store.enqueue(owner,resource.id,'test','snapshot-key',{conversationId:'chat',context:{allowedCards:[{id:'c',content:'long source'.repeat(10000)}]},original:'never ship this'})
  const snapshot=await lean.snapshot(owner,resource.id);assert.deepEqual(snapshot.job.basisIds,['c']);assert.equal(snapshot.job.conversationId,'chat');assert.ok(JSON.stringify(projected).length<2000);assert.equal(projected.checkpoints,undefined)
 },
 'provider hot paths leave expired records for bounded maintenance and metrics preserve unknown usage':async db=>{
  const owner='audit:'+randomUUID(),store=new DurableStore(db),now=Date.now(),old=now-8*86400000
  await db.query("INSERT INTO tp_provider_cache(owner_id,cache_key,body,expires_at) SELECT $1,'old-'||g,'{}'::jsonb,$2 FROM generate_series(1,1001) g",[owner,old])
  await db.query("INSERT INTO tp_provider_calls(id,owner_id,job_id,step,provider,body,created_at) SELECT $1||g,$1,'test-job','old','test','{}'::jsonb,$2 FROM generate_series(1,1001) g",[owner,old])
  await db.query('INSERT INTO tp_memories(owner_id,source_hash,summary,created_at) VALUES($1,$2,$3,$4)',[owner,'keep','permanent summary',old])
  const scope={ownerId:owner,jobId:'test-job',step:'direct'},input={messages:[{role:'user',content:'test'}],thinkingDepth:'fast'}
  const cached=cacheZhihuDirect({direct:async()=>({kind:'completed',text:'answer',cacheable:true})},db,'test')
  await providerScope.run(scope,()=>cached.direct(input))
  const p=instrumentProviders(db,{deepseekModelName:'test'},{complete:async()=>({kind:'completed',text:'{}'})},{direct:async()=>({kind:'completed',text:'answer'})})
  await providerScope.run(scope,()=>p.llm.complete({...input,json:true}))
  assert.equal((await db.query('SELECT count(*)::integer n FROM tp_provider_cache WHERE owner_id=$1 AND expires_at<$2',[owner,now]))[0].n,1001)
  assert.equal((await db.query('SELECT count(*)::integer n FROM tp_provider_calls WHERE owner_id=$1 AND created_at<$2',[owner,now]))[0].n,1001)
  const first=await store.maintain();assert.equal(first.more,true);assert.equal(first.removed.cache,1000);assert.equal(first.removed.calls,1000)
  await store.maintain()
  assert.equal((await db.query('SELECT count(*)::integer n FROM tp_provider_cache WHERE owner_id=$1',[owner]))[0].n,1)
  assert.equal((await db.query('SELECT summary FROM tp_memories WHERE owner_id=$1',[owner]))[0].summary,'permanent summary')
  await recordMetric(db,{owner_id:owner,id:'test-job'},'stage@version',{kind:'step',durationMs:10})
  await recordMetric(db,{owner_id:owner,id:'test-job'},'stage@version',{kind:'step',durationMs:30,result:'failed',code:'STRUCTURE_NOT_SETTLED'})
  const metrics=await readStageMetrics(db,now),stage=metrics.find(m=>m.stage==='stage');assert.equal(stage.samples,2);assert.equal(stage.failures,1);assert.equal(stage.p50_ms,20);assert.equal(stage.p95_ms,29)
  const llm=metrics.find(m=>m.provider==='deepseek');assert.equal(llm.reported_usage_samples,0);assert.equal(llm.reported_prompt_tokens,null)
 }
}
