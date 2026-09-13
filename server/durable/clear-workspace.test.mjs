import test from 'node:test'
import assert from 'node:assert/strict'
import {openDatabase,migrate} from './database.ts'
import {DurableStore} from './store.ts'
import {DurableWorker} from './worker.ts'
import {createProductApp} from './http.ts'
import {verifyWorkspaceClear} from './clear-workspace-cases.mjs'
import {clearWorkspace} from './clear-workspace.ts'
import {workspaceWrites} from './workspace-fence.ts'

test('clear deletes all owned content, fences delayed writes and preserves other accounts and new work',async t=>{
  const db=await openDatabase();t.after(()=>db.close());await verifyWorkspaceClear(db)
})
test('clearing guest A aborts only A and rejects an abort-ignoring provider while guest B completes',async t=>{
  const db=await openDatabase();await migrate(db);const store=new DurableStore(db)
  const a=await store.create('guest:A','test','a',{}),b=await store.create('guest:B','test','b',{})
  await store.enqueue('guest:A',a.id,'test','guest-a-command',{})
  await store.enqueue('guest:B',b.id,'test','guest-b-command',{})
  const jobs=[await store.claim(),await store.claim()]
  const entered=Promise.withResolvers(),release=Promise.withResolvers(),signals=new Map();let started=0
  const worker=new DurableWorker(store,async ctx=>{
    signals.set(ctx.job.owner_id,ctx.signal)
    if(++started===2)entered.resolve()
    await release.promise
    await ctx.store.db.query('INSERT INTO tp_memories(owner_id,source_hash,summary,created_at) VALUES($1,$2,$3,$4)',[ctx.job.owner_id,'late-result','private result',Date.now()])
    await ctx.store.commit(ctx.job,()=>({finished:true}))
  },2,()=>{})
  t.after(async()=>{await worker.stop();await db.close()})
  const running=jobs.map(j=>worker.execute(j));await entered.promise
  await clearWorkspace(store,'guest:A','clear-only-a')
  assert.equal(signals.get('guest:A').aborted,true);assert.equal(signals.get('guest:B').aborted,false)
  release.resolve();await Promise.all(running)
  assert.equal((await store.list('guest:A','test')).length,0)
  assert.equal((await db.query('SELECT * FROM tp_memories WHERE owner_id=$1',['guest:A'])).length,0)
  assert.equal((await db.query('SELECT * FROM tp_provider_calls WHERE owner_id=$1',['guest:A'])).length,0)
  assert.deepEqual((await store.resource('guest:B',b.id)).body,{finished:true})
})
test('HTTP clear requires identity, confirmation, origin and idempotency; stale tabs cannot write',async t=>{
  const db=await openDatabase();await migrate(db);const store=new DurableStore(db),worker=new DurableWorker(store,async()=>{},1,()=>{})
  const app=await createProductApp({store,worker,identity:{production:true,origin:'https://threadpeak.test'},providersReady:true})
  t.after(async()=>{await app.close();await db.close()})
  assert.equal((await app.inject({method:'POST',url:'/api/v2/workspace/clear',payload:{}})).statusCode,401)
  const login=await app.inject({method:'POST',url:'/api/auth/guest'}),cookie=login.headers['set-cookie'].map(c=>c.split(';')[0]).join('; ')
  const headers={cookie,origin:'https://threadpeak.test','idempotency-key':'clear-command-1','x-workspace-generation':'0'}
  assert.equal((await app.inject({method:'POST',url:'/api/v2/workspace/clear',headers,payload:{}})).statusCode,400)
  const body={confirm:'clear-all-learning-data'}
  const second=await app.inject({method:'POST',url:'/api/auth/guest'}),otherCookie=second.headers['set-cookie'].map(c=>c.split(';')[0]).join('; ')
  const one=(await app.inject({url:'/api/v2/session',headers:{cookie}})).json(),two=(await app.inject({url:'/api/v2/session',headers:{cookie:otherCookie}})).json()
  headers['x-workspace-id']=one.workspaceId
  assert.notEqual(one.workspaceId,two.workspaceId,'same IP without shared cookies must create different guests')
  const owner=(await db.query('SELECT owner_id FROM tp_sessions ORDER BY owner_id')).map(r=>r.owner_id)
  assert.equal(new Set(owner).size,2)
  const bob=await app.inject({method:'POST',url:'/api/v2/attachments',headers:{cookie:otherCookie,'idempotency-key':'bob-upload-file'},payload:{fileName:'bob.txt',base64:Buffer.from('B 的独立资料').toString('base64')}})
  assert.equal(bob.statusCode,200)
  assert.equal((await app.inject({url:'/api/v2/materials',headers:{...headers,cookie:otherCookie}})).statusCode,409,'old account page cannot read new cookie account')
  assert.equal((await app.inject({method:'POST',url:'/api/v2/attachments',headers:{...headers,cookie:otherCookie},payload:{fileName:'wrong-owner.txt',base64:'bWl4ZWQ='}})).statusCode,409,'old account page cannot write into new cookie account')
  assert.equal((await app.inject({method:'POST',url:'/api/v2/workspace/clear',headers:{...headers,cookie:otherCookie},payload:body})).statusCode,409,'old A confirmation must never clear B after cookie switch')
  assert.equal((await app.inject({method:'POST',url:'/api/v2/workspace/clear',headers:Object.fromEntries(Object.entries(headers).filter(([key])=>key!=='x-workspace-id')),payload:body})).statusCode,400)
  assert.equal((await app.inject({method:'POST',url:'/api/v2/workspace/clear',headers,payload:{...body,ownerId:two.workspaceId}})).statusCode,400)
  assert.equal((await app.inject({method:'POST',url:'/api/v2/workspace/clear',headers:{cookie,origin:headers.origin,'idempotency-key':'missing-generation'},payload:body})).statusCode,400)

  assert.equal((await app.inject({method:'POST',url:'/api/v2/workspace/clear',headers:{...headers,origin:'https://outside.test'},payload:body})).statusCode,403)
  assert.equal((await app.inject({method:'POST',url:'/api/v2/workspace/clear',headers,payload:body})).statusCode,200)
  const session=(await app.inject({url:'/api/v2/session',headers:{cookie}})).json()
  assert.equal(session.dataGeneration,1)
  const otherSession=(await app.inject({url:'/api/v2/session',headers:{cookie:otherCookie}})).json()
  assert.equal(otherSession.dataGeneration,0);assert.equal(otherSession.workspaceId,two.workspaceId)
  const materials=await app.inject({url:'/api/v2/materials',headers:{cookie:otherCookie}})
  assert.equal(materials.statusCode,200);assert.match(materials.body,/bob.txt/)
  assert.equal((await app.inject({method:'POST',url:'/api/v2/workspace/clear',headers:{...headers,'idempotency-key':'stale-confirmation'},payload:body})).statusCode,409)
  assert.equal((await app.inject({method:'POST',url:'/api/v2/workspace/clear',headers,payload:body})).statusCode,200,'same command replay remains safe')
  assert.equal((await app.inject({url:'/api/v2/library',headers:{cookie,'x-workspace-generation':'0'}})).json().code,'WORKSPACE_CLEARED')
  assert.equal((await app.inject({url:'/api/v2/library',headers:{cookie,'x-workspace-generation':'1'}})).statusCode,200)
})


test('global worker scheduling never inherits a cleared guest generation',async t=>{
  const db=await openDatabase();await migrate(db);const store=new DurableStore(db)
  await clearWorkspace(store,'guest:cleared','clear-before-wake')
  const b=await store.create('guest:other','test','b',{})
  await store.enqueue('guest:other',b.id,'test','job-after-clear',{})
  const done=Promise.withResolvers(),logs=[]
  const worker=new DurableWorker(store,async ctx=>{await store.commit(ctx.job,()=>({done:true}));done.resolve()},1,v=>logs.push(v))
  t.after(async()=>{await worker.stop();await db.close()})
  workspaceWrites.run({owner:'guest:cleared',generation:0},()=>worker.start())
  let timeout
  try{await Promise.race([done.promise,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('other guest was blocked by stale scheduler context')),2000)})])}finally{clearTimeout(timeout)}
  assert.deepEqual((await store.resource('guest:other',b.id)).body,{done:true})
  assert.equal(logs.some(v=>v.event==='worker.storage_unavailable'),false)
})
