import test from 'node:test'
import assert from 'node:assert/strict'
import {openDatabase,migrate} from './database.ts'
import {DurableStore,MAX_MANUAL_RESUMES,MAX_JOB_FAILURES} from './store.ts'
import {DurableWorker,classifyTaskError} from './worker.ts'
import {withPermit} from './limits.ts'
import {verifyNestedTransactions} from './transaction-cases.mjs'
const fixture=async t=>{const db=await openDatabase();await migrate(db);t.after(()=>db.close());let now=Date.now();return {db,store:new DurableStore(db,()=>now),advance:ms=>{now+=ms}}}
const jobFor=async store=>{const r=await store.create('owner','test','scope',{});await store.enqueue('owner',r.id,'test','command',{q:'original'});return {r,job:await store.claim()}}

test('PGlite nested transactions roll back together and support isolated savepoints',async t=>{const {db}=await fixture(t);await verifyNestedTransactions(db)})
test('expired lease can renew before takeover, but no renewal can cross a newer fence',async t=>{
 const {store,advance}=await fixture(t),{job}=await jobFor(store)
 advance(100_000);assert.equal(await store.renew(job),true);assert.equal(await store.claim(),undefined)
 advance(100_000);const next=await store.claim();assert.equal(next.id,job.id);assert.equal(next.attempts,0)
 assert.equal(await store.renew(job),false);assert.equal(await store.renew(next),true)
})
test('claims never consume failure budget; automatic and manual retries are bounded',async t=>{
 const {store,advance}=await fixture(t),{r}=await jobFor(store)
 let job
 for(let i=0;i<3;i++){advance(100_000);job=await store.claim();assert.equal(job.attempts,0)}
 for(let i=1;i<=MAX_JOB_FAILURES;i++){await store.recover(job,'NETWORK_UNAVAILABLE',true);const snapshot=await store.snapshot('owner',r.id);assert.equal(snapshot.job.attempts,i);advance(100_000);if(i<MAX_JOB_FAILURES)job=await store.claim()}
 assert.equal((await store.snapshot('owner',r.id)).job.status,'waiting')
 for(let i=0;i<MAX_MANUAL_RESUMES;i++){advance(31_000);await store.resume('owner',r.id);job=await store.claim();await store.recover(job,'CONFIG_REQUIRED',false)}
 assert.equal((await store.snapshot('owner',r.id)).job.recoverable,false)
 await assert.rejects(store.resume('owner',r.id),e=>e.code==='RETRY_BUDGET_EXHAUSTED')
})
test('explicit empty-search retries are bounded and archive all prior checkpoints',async t=>{
 const {store,advance}=await fixture(t),r=await store.create('owner','learning','empty',{phase:'searching'})
 await store.enqueue('owner',r.id,'learning.enter','empty',{})
 for(let i=0;i<=MAX_MANUAL_RESUMES;i++){
   const job=await store.claim();await store.checkpoint(job,'search','hash',{items:[]});await store.commit(job,()=>({phase:'empty'}));advance(31_000)
   if(i<MAX_MANUAL_RESUMES)await store.resume('owner',r.id)
 }
 const done=await store.existingCommand('owner','empty');assert.equal(done.resume_count,MAX_MANUAL_RESUMES)
 for(let i=1;i<=MAX_MANUAL_RESUMES;i++)assert.deepEqual(done.checkpoints[`previous:${i}:search`].value,{items:[]})
 await assert.rejects(store.resume('owner',r.id),e=>e.code==='RETRY_BUDGET_EXHAUSTED')
 assert.equal((await store.snapshot('owner',r.id)).job.recoverable,false)
})
test('network/timeout/transient SQL failures retry while application bugs and explicit cancellation do not',()=>{
 for(const error of [new TypeError('fetch failed'),new DOMException('timeout','TimeoutError'),new DOMException('abort','AbortError'),Object.assign(new Error(),{code:'40001'}),Object.assign(new Error(),{cause:{code:'ECONNRESET'}})])assert.equal(classifyTaskError(error).retryable,true)
 for(const error of [new TypeError('Cannot read properties of undefined'),new Error('invalid input')])assert.equal(classifyTaskError(error).retryable,false)
 assert.equal(classifyTaskError(new DOMException('abort','AbortError'),true).retryable,false)
})
test('cancellation aborts a running local provider immediately and keeps committed data unchanged',async t=>{
 const {store}=await fixture(t),{r,job}=await jobFor(store)
 let ready;const entered=new Promise(resolve=>{ready=resolve});let aborted=false
 const worker=new DurableWorker(store,async ctx=>{ready();await new Promise((resolve,reject)=>{ctx.signal.addEventListener('abort',()=>{aborted=true;reject(ctx.signal.reason)},{once:true})})},1,()=>{})
 const task=worker.execute(job);await entered;await store.cancel('owner',r.id);assert.equal(aborted,true);await task
 assert.deepEqual((await store.snapshot('owner',r.id)).data,{})
})
test('retention compacts transient data, keeps idempotency receipts, and requires snapshot on event gaps',async t=>{
 const {store,advance,db}=await fixture(t),{r,job}=await jobFor(store)
 await store.progress(job,'draft','large text'.repeat(1000));await store.checkpoint(job,'search','hash',{text:'large evidence'.repeat(1000)});await store.commit(job,()=>({answer:'retained'}))
 advance(31*86400_000);await store.maintain()
 const compact=await store.existingCommand('owner','command');assert.deepEqual(compact.checkpoints,{});assert.equal(compact.compacted,true)
 assert.equal((await store.enqueue('owner',r.id,'test','command',{q:'original'})).id,job.id)
 await assert.rejects(store.enqueue('owner',r.id,'test','command',{q:'changed'}),e=>e.code==='COMMAND_CONFLICT')
 await assert.rejects(store.events('owner',r.id,0),e=>e.code==='EVENT_GAP')
 assert.equal((await store.snapshot('owner',r.id)).data.answer,'retained');assert.equal((await db.query('SELECT * FROM tp_events')).length,0)
})
test('provider permit ordering rejects reversed cache locks and reclaims a crashed holder',async t=>{
 const {db}=await fixture(t)
 await withPermit(db,'zhihu',2,undefined,async()=>assert.rejects(withPermit(db,'direct-cache:test',1,undefined,async()=>{}),e=>e.code==='PERMIT_ORDER_INVALID'))
 await db.query("INSERT INTO tp_provider_slots(pool,slot,token,lease_until) VALUES('crash',0,'dead',10)")
 let called=false;await withPermit(db,'crash',1,undefined,async()=>{called=true},{now:()=>100})
 assert.equal(called,true)
})

import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
test('PGlite directory refuses a second owner and reopens after release',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'tp-owner-'));let db
 try{db=await openDatabase({directory});await assert.rejects(openDatabase({directory}),/PGLITE_DIRECTORY_IN_USE/);await db.close();db=await openDatabase({directory});await db.query('SELECT 1')}finally{await db?.close();await rm(directory,{recursive:true,force:true})}
})

test('cancellation between claim and dispatch prevents any provider work',async t=>{
 const {store}=await fixture(t),{r,job}=await jobFor(store)
 await store.cancel('owner',r.id)
 const worker=new DurableWorker(store,async()=>assert.fail('cancelled job invoked provider'),1,()=>{})
 let called=false;worker.handler=async()=>{called=true}
 await worker.execute(job);assert.equal(called,false)
})

test('hourly recovery quota counts individual admissions, not the lifetime count on recently resumed jobs',async t=>{
 const {store,advance,db}=await fixture(t),{r}=await jobFor(store);let job=await store.existingCommand('owner','command');await store.recover(job,'CONFIG_REQUIRED',false)
 for(let n=0;n<3;n++){advance(31_000);await store.resume('owner',r.id);job=await store.claim();await store.recover(job,'CONFIG_REQUIRED',false)}
 advance(3_600_001);await store.resume('owner',r.id);job=await store.claim();await store.recover(job,'CONFIG_REQUIRED',false)
 const now=store.now()
 await db.query(`INSERT INTO tp_jobs(id,owner_id,resource_id,command_key,input_hash,kind,input,status,phase,created_at,updated_at)
 SELECT 'quota-'||n,'owner',$1,'quota-'||n,'hash','test','{}','completed','done',$2,$2 FROM generate_series(1,118) n`,[r.id,now])
 const second=await store.create('owner','test','second',{})
 await store.enqueue('owner',second.id,'test','admission-120',{})
 const third=await store.create('owner','test','third',{})
 await assert.rejects(store.enqueue('owner',third.id,'test','admission-121',{}),e=>e.code==='ACCOUNT_BUSY')
 advance(3_600_001);await store.enqueue('owner',third.id,'test','admission-new-hour',{})
 assert.equal((await db.query('SELECT * FROM tp_job_resumes WHERE job_id=$1',[job.id])).length,4)
})

test('snapshot data revision changes for published content but not task progress or activity',async t=>{
 const {store}=await fixture(t),{r,job}=await jobFor(store)
 const initial=await store.snapshot('owner',r.id)
 await store.progress(job,'draft','draft');await store.activity(job,{id:'reading',kind:'read',title:'reading',status:'running'})
 const progress=await store.snapshot('owner',r.id);assert.ok(progress.revision>initial.revision);assert.equal(progress.dataRevision,initial.dataRevision)
 await store.commit(job,()=>({answer:'published'}));const committed=await store.snapshot('owner',r.id);assert.equal(committed.dataRevision,committed.revision);assert.ok(committed.dataRevision>progress.dataRevision)
})
