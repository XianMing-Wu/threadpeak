import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {openDatabase,migrate} from './database.ts'
import {DurableStore} from './store.ts'
import {withPermit} from './limits.ts'
const url=process.env.TEST_DATABASE_URL
if(!url||new URL(url).pathname!=='/threadpeak_test')throw new Error('An isolated threadpeak_test database is required')
test('PostgreSQL: two connections, concurrent migrations, idempotency, fencing, atomic commit and reconnect',async()=>{
  const a=await openDatabase({url}),b=await openDatabase({url});let c
  try{
    await Promise.all([migrate(a),migrate(b)])
    await a.query("UPDATE tp_jobs SET status='cancelled' WHERE owner_id LIKE 'pg-test:%' AND status IN ('queued','running','waiting')")
    let clock=Date.now();const one=new DurableStore(a,()=>clock),two=new DurableStore(b,()=>clock),owner='pg-test:'+randomUUID()
    const resource=await one.create(owner,'test','scope',{nodes:[]})
    const jobs=await Promise.all(Array.from({length:12},(_,i)=>(i%2?one:two).enqueue(owner,resource.id,'test','pg-same-command',{q:'preserve input'})))
    assert.equal(new Set(jobs.map(j=>j.id)).size,1)
    const claims=await Promise.all([one.claim(20),two.claim(20)])
    assert.equal(claims.filter(Boolean).length,1);const original=claims.find(Boolean)
    assert.equal(typeof original.lease_until,'number');assert.equal(typeof resource.created_at,'number')
    await one.checkpoint(original,'search','input-hash',{evidence:'retained'})
    clock+=100;const resumed=await two.claim();assert.equal(resumed.id,original.id);assert.ok(resumed.fence>original.fence)
    assert.deepEqual(resumed.checkpoints.search.value,{evidence:'retained'})
    await assert.rejects(one.commit(original,()=>({nodes:['stale']})),e=>e.code==='LEASE_LOST')
    await assert.rejects(two.commit(resumed,()=>{throw new Error('abort transaction')}))
    assert.deepEqual((await one.snapshot(owner,resource.id)).data.nodes,[])
    await two.commit(resumed,()=>({nodes:['one committed card']}))
    await assert.rejects(one.snapshot('other-owner',resource.id),e=>e.status===404)
    c=await openDatabase({url});const reconnect=new DurableStore(c)
    assert.deepEqual((await reconnect.snapshot(owner,resource.id)).data.nodes,['one committed card'])
    const events=await reconnect.events(owner,resource.id,0);assert.equal(events.filter(e=>e.kind==='job.completed').length,1)
    let active=0,max=0;const pool='test-'+randomUUID()
    await Promise.all(Array.from({length:8},(_,i)=>withPermit(i%2?a:b,pool,2,undefined,async()=>{active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,30));active--})))
    assert.equal(max,2)
  }finally{await Promise.all([a.close(),b.close(),c?.close()])}
})

import {verifyNestedTransactions} from './transaction-cases.mjs'
test('PostgreSQL shares the same nested transaction rollback contract',async()=>{
 const db=await openDatabase({url});try{await verifyNestedTransactions(db)}finally{await db.close()}
})

import {spawn} from 'node:child_process'
test('PostgreSQL permits are shared by three independent Node processes', {timeout:30000}, async()=>{
  const db=await openDatabase({url}),pool='process-test-'+randomUUID(),children=[]
  const code=`import {openDatabase} from ${JSON.stringify(new URL('./database.ts',import.meta.url).href)};
    import {withPermit} from ${JSON.stringify(new URL('./limits.ts',import.meta.url).href)};
    const db=await openDatabase({url:process.env.TEST_DATABASE_URL});
    try{await withPermit(db,process.env.TEST_PERMIT_POOL,2,undefined,async()=>{
      process.send('held');await new Promise(resolve=>process.once('message',resolve));
    },{onQueue:async detail=>{if(detail)process.send('queued')}})}finally{await db.close();process.disconnect()}`
  try{
    await migrate(db)
    for(let i=0;i<3;i++){
      const child=spawn(process.execPath,['--input-type=module','--eval',code],{env:{...process.env,TEST_PERMIT_POOL:pool},stdio:['ignore','ignore','pipe','ipc']})
      let first;const ready=new Promise(resolve=>{first=resolve}),held=Promise.withResolvers()
      child.on('message',message=>{first(message);if(message==='held')held.resolve()})
      const exit=new Promise((resolve,reject)=>{child.once('exit',status=>status===0?resolve():reject(Error('permit subprocess failed')));child.once('error',reject)})
      children.push({child,ready,held,exit})
    }
    const states=await Promise.all(children.map(c=>c.ready));assert.equal(states.filter(s=>s==='held').length,2);assert.equal(states.filter(s=>s==='queued').length,1)
    assert.equal((await db.query('SELECT * FROM tp_provider_slots WHERE pool=$1 AND token IS NOT NULL',[pool])).length,2)
    const first=children[states.indexOf('held')],waiting=children[states.indexOf('queued')]
    first.child.send('release');await first.exit;await waiting.held.promise
    for(const c of children)if(c!==first)c.child.send('release')
    await Promise.all(children.map(c=>c.exit))
  }finally{for(const c of children)if(c.child.exitCode===null)c.child.kill();await db.close()}
})

import {DurableWorker} from './worker.ts'
test('PostgreSQL: graceful handoff is immediate, preserves checkpoints, and maintenance compacts safely',async()=>{
 const a=await openDatabase({url}),b=await openDatabase({url});let worker
 try{
  await migrate(a);let now=Date.now();const one=new DurableStore(a,()=>now),two=new DurableStore(b,()=>now),owner='pg-test:'+randomUUID()
  const r=await one.create(owner,'test','shutdown',{});await one.enqueue(owner,r.id,'test','shutdown',{})
  let ready;const entered=new Promise(resolve=>{ready=resolve});let original
  worker=new DurableWorker(one,async ctx=>{original=ctx.job;await one.checkpoint(ctx.job,'paid-provider','hash',{answer:'saved'});ready();await new Promise((_,reject)=>ctx.signal.addEventListener('abort',()=>reject(ctx.signal.reason),{once:true}))},1,()=>{})
  worker.start();await entered;await worker.stop()
  const claimed=await two.claim();assert.equal(claimed.id,original.id);assert.equal(claimed.attempts,0);assert.equal(claimed.checkpoints['paid-provider'].value.answer,'saved')
  await assert.rejects(one.commit(original,()=>({late:true})),e=>e.code==='LEASE_LOST');await two.commit(claimed,()=>({answer:'saved'}))
  now+=31*86400_000;await one.maintain();assert.equal((await one.existingCommand(owner,'shutdown')).compacted,true)
  assert.equal((await one.enqueue(owner,r.id,'test','shutdown',{})).id,original.id)
  assert.equal((await one.snapshot(owner,r.id)).data.answer,'saved')
 }finally{await worker?.stop();await Promise.all([a.close(),b.close()])}
})

import {verifyEventCAS} from './storage-cases.mjs'
import {createProductApp} from './http.ts'
test('PostgreSQL: event CAS is atomic even when the caller omits its row lock',async()=>{
 const db=await openDatabase({url});try{await migrate(db);await verifyEventCAS(db)}finally{await db.close()}
})
test('PostgreSQL: a snapshot reads the previous coherent commit while a writer holds resource/job locks',async()=>{
 const a=await openDatabase({url}),b=await openDatabase({url});let finish,write
 try{
  await migrate(a);const one=new DurableStore(a),two=new DurableStore(b),owner='pg-test:'+randomUUID(),r=await one.create(owner,'test','mvcc',{value:'old'})
  await one.enqueue(owner,r.id,'test','mvcc',{});const job=await one.claim()
  let ready;const entered=new Promise(resolve=>{ready=resolve}),hold=new Promise(resolve=>{finish=resolve})
  write=a.transaction(async tx=>{await tx.query('UPDATE tp_resources SET body=$2::jsonb WHERE id=$1',[r.id,JSON.stringify({value:'new'})]);await tx.query("UPDATE tp_jobs SET status='completed' WHERE id=$1",[job.id]);ready();await hold})
  await entered
  let timer
  try{
   const snapshot=await Promise.race([two.snapshot(owner,r.id),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('snapshot waited on writer')),2000)})])
   assert.deepEqual(snapshot.data,{value:'old'});assert.equal(snapshot.job.status,'running')
  }finally{clearTimeout(timer);finish();await write}
  const next=await two.snapshot(owner,r.id);assert.deepEqual(next.data,{value:'new'});assert.equal(next.job.status,'completed')
 }finally{finish?.();await write;await Promise.all([a.close(),b.close()])}
})
test('PostgreSQL: two actual HTTP instances and a restarted instance share one rate budget',async()=>{
 const a=await openDatabase({url}),b=await openDatabase({url}),apps=[]
 try{
  await migrate(a);const make=async db=>{const store=new DurableStore(db),worker=new DurableWorker(store,async()=>{},1,()=>{});const app=await createProductApp({store,worker,identity:{production:false},providersReady:true,requestLimit:4});apps.push(app);return app}
  const one=await make(a),two=await make(b)
  const suffix=randomUUID().replaceAll('-','').slice(0,16).match(/.{4}/g).join(':'),ip='2001:db8:'+suffix+'::1'
  const results=await Promise.all(Array.from({length:16},(_,i)=>(i%2?one:two).inject({url:'/api/auth/config',remoteAddress:ip})))
  assert.equal(results.filter(r=>r.statusCode===200).length,4);assert.equal(results.filter(r=>r.statusCode===429).length,12)
  const again=await make(b);const denied=await again.inject({url:'/api/auth/config',remoteAddress:ip});assert.equal(denied.statusCode,429);assert.ok(Number(denied.headers['retry-after'])>0)
 }finally{await Promise.all(apps.map(app=>app.close()));await Promise.all([a.close(),b.close()])}
})

import {platformCases} from './audit-platform-cases.mjs'
for(const [name,verify] of Object.entries(platformCases))test(`PostgreSQL audit repair: ${name}`,async()=>{
 const db=await openDatabase({url});try{await migrate(db);await verify(db)}finally{await db.close()}
})
