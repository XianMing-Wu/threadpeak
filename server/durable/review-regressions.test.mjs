import test from 'node:test'
import assert from 'node:assert/strict'
import {openDatabase,migrate} from './database.ts'
import {DurableStore,MAX_LEASE_TAKEOVERS} from './store.ts'
import {DurableWorker,TaskContext} from './worker.ts'
import {createProductApp,trustedProxies} from './http.ts'
import {ProductTools} from './tools.ts'
import {readStageMetrics} from './ops-metrics.ts'

async function fixture(t,ready=true){
 const db=await openDatabase();await migrate(db);let now=Date.now()
 const store=new DurableStore(db,()=>now),worker=new DurableWorker(store,async()=>{},1,()=>{})
 const app=await createProductApp({store,worker,providersReady:ready,identity:{production:false,origin:'https://threadpeak.test/path/'}})
 t.after(async()=>{await app.close();await db.close()})
 const login=await app.inject({method:'POST',url:'/api/auth/guest',headers:{origin:'https://threadpeak.test'}})
 assert.equal(login.statusCode,200)
 const headers={cookie:login.headers['set-cookie'][0].split(';')[0],origin:'https://threadpeak.test'}
 const [session]=await db.query('SELECT owner_id FROM tp_sessions')
 return {db,store,worker,app,headers,owner:session.owner_id,advance:ms=>{now+=ms}}
}
test('crash takeovers stop separately from failures, preserve checkpoints, emit a waiting event and resume explicitly',async t=>{
 const {store,owner,advance}=await fixture(t),r=await store.create(owner,'test','crash',{})
 await store.enqueue(owner,r.id,'test','crash-command',{});let job=await store.claim()
 await store.checkpoint(job,'paid','hash',{evidence:'retained'})
 for(let n=1;n<MAX_LEASE_TAKEOVERS;n++){advance(100_000);job=await store.claim();assert.equal(job.lease_takeovers,n);assert.equal(job.attempts,0)}
 advance(100_000);assert.equal(await store.claim(),undefined)
 const waiting=await store.existingCommand(owner,'crash-command');assert.equal(waiting.status,'waiting');assert.equal(waiting.error_code,'LEASE_TAKEOVER_LIMIT')
 assert.equal((await store.events(owner,r.id,0)).at(-1).kind,'job.waiting')
 await assert.rejects(store.commit(job,()=>({late:true})),e=>e.code==='LEASE_LOST')
 await store.resume(owner,r.id);const resumed=await store.claim();assert.equal(resumed.lease_takeovers,0);assert.deepEqual(resumed.checkpoints.paid.value,{evidence:'retained'})
 advance(100_000);assert.equal(await store.claim(undefined,[resumed.id]),undefined)
})
test('draft changes keep the body and event revision stable while lightweight snapshots carry the latest draft',async t=>{
 const {store,owner,advance}=await fixture(t),r=await store.create(owner,'test','draft',{large:'body'.repeat(1000)})
 await store.enqueue(owner,r.id,'test','draft-command',{});const job=await store.claim()
 await store.progress(job,'writing','first');const first=await store.snapshot(owner,r.id)
 for(let i=0;i<20;i++){advance(150);await store.progress(job,'writing',`draft-${i}`)}
 const next=await store.snapshot(owner,r.id,first.dataRevision)
 assert.equal(next.unchanged,true);assert.equal(next.data,undefined);assert.equal(next.revision,first.revision);assert.equal(next.job.draft,'draft-19')
 await store.commit(job,()=>({answer:'final'}));const final=await store.snapshot(owner,r.id,first.dataRevision)
 assert.deepEqual(final.data,{answer:'final'});assert.equal(final.job.status,'completed')
})
test('materials paginate metadata without source bodies, validate cursors, and fetch selected full content',async t=>{
 const {store,owner,app,headers}=await fixture(t)
 const ids=[];for(let n=0;n<52;n++)ids.push((await store.create(owner,'attachment',String(n),{fileName:`file-${n}.txt`,origin:'upload',status:'ready',bytes:20,content:'private full source',rawContent:'private original',entries:[]})).id)
 const page=(await app.inject({url:'/api/v2/materials',headers})).json()
 assert.equal(page.items.length,50);assert.ok(page.nextCursor);assert.ok(page.items.every(i=>i.content===undefined&&i.rawContent===undefined&&i.entries===undefined))
 const last=(await app.inject({url:`/api/v2/materials?cursor=${page.nextCursor}`,headers})).json()
 assert.equal(last.items.length,2);assert.equal(new Set([...page.items,...last.items].map(i=>i.sourceId)).size,52)
 assert.equal((await app.inject({url:`/api/v2/materials/${ids[0]}`,headers})).json().content,'private full source')
 assert.equal((await app.inject({url:'/api/v2/materials?cursor=invalid',headers})).statusCode,400)
})
test('material count and byte reservations are atomic, owner scoped and do not charge a replay twice',async t=>{
 const {db}=await fixture(t),store=new DurableStore(db,Date.now,{count:2,bytes:10}),body={origin:'upload',bytes:6,status:'ready',content:'source'}
 const results=await Promise.allSettled(['one','two'].map(id=>store.create('quota-owner','attachment',id,body)))
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
 assert.equal(results.find(r=>r.status==='rejected').reason.code,'MATERIAL_QUOTA_EXCEEDED')
 const old=results.find(r=>r.status==='fulfilled').value
 assert.equal((await store.create('quota-owner','attachment',old.scope,body)).id,old.id)
 assert.ok(await store.create('other-owner','attachment','one',body))
 await store.create('quota-owner','attachment','empty',{origin:'upload',bytes:0})
 await assert.rejects(store.create('quota-owner','attachment','third',{origin:'upload',bytes:0}),e=>e.code==='MATERIAL_QUOTA_EXCEEDED')
})
test('raw upload parser is scoped and missing command keys cannot allocate a resource',async t=>{
 const {app,headers,store,owner}=await fixture(t)
 const raw={...headers,'content-type':'application/octet-stream'}
 assert.equal((await app.inject({method:'POST',url:'/api/v2/chats/enter',headers:raw,payload:Buffer.from('not JSON')})).statusCode,415)
 const upload=await app.inject({method:'POST',url:'/api/v2/materials/upload?name=a.txt',headers:raw,payload:Buffer.from('full text')})
 assert.equal(upload.statusCode,400);assert.equal(upload.json().code,'IDEMPOTENCY_KEY_REQUIRED')
 assert.equal((await store.list(owner,'attachment')).length,0)
 assert.equal((await app.inject({method:'POST',url:'/api/path-runs',headers,payload:{goal:'learn'}})).json().code,'IDEMPOTENCY_KEY_REQUIRED')
 assert.throws(()=>trustedProxies(['0.0.0.0/0']),/TRUSTED_PROXY_CONFIG_INVALID/)
 assert.throws(()=>trustedProxies(['::/0']),/TRUSTED_PROXY_CONFIG_INVALID/)
})
test('unconfigured generation refuses before durable acceptance while existing chats remain readable',async t=>{
 const {app,headers,store,owner}=await fixture(t,false)
 for(const [url,payload] of [['/api/path-runs',{goal:'learn'}],['/api/v2/chats/enter',{chatId:'new-chat',question:'hello'}],['/api/v2/authors/search',{}]]){
   const result=await app.inject({method:'POST',url,headers:{...headers,'idempotency-key':'unconfigured-command'},payload})
   assert.equal(result.statusCode,503);assert.equal(result.json().code,'PROVIDER_CONFIG_REQUIRED')
 }
 assert.equal((await store.list(owner,'chat')).length,0);assert.equal((await store.list(owner,'path')).length,0)
 const old=await store.create(owner,'chat','previous-chat',{title:'previous',messages:[]});await store.enqueue(owner,old.id,'chat.reply','old-command',{});await store.commit(await store.claim(),r=>r.body)
 assert.equal((await app.inject({method:'POST',url:'/api/v2/chats/enter',headers,payload:{chatId:'previous-chat',question:'previous'}})).json().id,old.id)
})
test('a handler returning without completion moves to explicit waiting and cannot log completed',async t=>{
 const {store,owner}=await fixture(t),r=await store.create(owner,'test','missing-commit',{})
 await store.enqueue(owner,r.id,'test','missing-commit',{})
 const logs=[],worker=new DurableWorker(store,async()=>{},1,e=>logs.push(e))
 await worker.execute(await store.claim())
 assert.equal((await store.snapshot(owner,r.id)).job.status,'waiting');assert.ok(!logs.some(e=>e.event==='task.completed'))
})
test('web catalog searches pass the frozen scope through both providers',async t=>{
 const {store,owner}=await fixture(t),r=await store.create(owner,'test','catalog',{}),calls=[]
 await store.enqueue(owner,r.id,'test','catalog-command',{})
 const ctx=new TaskContext(store,await store.claim(),new AbortController().signal)
 const tools=new ProductTools({}, {search:async q=>{calls.push(['zhihu',q]);return {kind:'empty'}},globalSearch:async q=>{calls.push(['web',q]);return {kind:'empty'}}})
 await tools.catalogSearches(ctx,['book one','book two','book three'],{kind:'web'})
 assert.equal(calls.filter(([kind])=>kind==='zhihu').length,3);assert.equal(calls.filter(([kind])=>kind==='web').length,3)
})
test('dirty optional numeric metrics do not break the operations report',async t=>{
 const {db}=await fixture(t)
 await db.query("INSERT INTO tp_provider_calls(id,owner_id,job_id,step,provider,body,created_at) VALUES('dirty-test','owner','job','step','test',$1::jsonb,$2)",[JSON.stringify({durationMs:'bad',queueMs:'NaN',modelCalls:'1e500',chunkCount:-1,usage:{prompt_tokens:'not numeric'}}),Date.now()])
 const rows=await readStageMetrics(db);assert.equal(rows.length,1);assert.equal(rows[0].p50_ms,null);assert.equal(rows[0].summary_model_calls,null)
})
