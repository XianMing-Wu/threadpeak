import test from 'node:test'
import assert from 'node:assert/strict'
import {setImmediate as turn} from 'node:timers/promises'
import {openDatabase,migrate} from './database.ts'
import {DurableStore} from './store.ts'
import {DurableWorker} from './worker.ts'
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve}}

test('maintenance failures back off independently; blocked maintenance never blocks claims',async t=>{
 t.mock.timers.enable({apis:['setTimeout']})
 let claims=0,maintenance=0;const logs=[],blocked=deferred()
 const store={claim:async()=>{claims++;return undefined},maintain:async()=>{maintenance++;if(maintenance<=2)throw Object.assign(new Error('private database details'),{code:'ECONNRESET'});await blocked.promise}}
 const worker=new DurableWorker(store,async()=>{},1,e=>logs.push(e),{maintenanceDelayMs:1000,maintenanceRetryMs:1000,drainMs:100})
 worker.start();await turn();assert.equal(claims,1);assert.equal(maintenance,0)
 t.mock.timers.tick(1000);await turn();assert.equal(maintenance,1);assert.ok(claims>1)
 t.mock.timers.tick(1000);await turn();assert.equal(maintenance,2)
 t.mock.timers.tick(1000);await turn();assert.equal(maintenance,2)
 t.mock.timers.tick(1000);await turn();assert.equal(maintenance,3)
 const count=claims;t.mock.timers.tick(1000);await turn();assert.ok(claims>count)
 assert.equal(logs[0].code,'ECONNRESET');assert.equal(logs[1].retryInMs,2000);assert.ok(!JSON.stringify(logs).includes('private database'))
 blocked.resolve();await worker.stop();const stopped=claims;t.mock.timers.tick(3_600_000);await turn();assert.equal(claims,stopped)
})
test('shutdown immediately releases its fence and checkpoints without spending failure budget',async t=>{
 const db=await openDatabase();await migrate(db);t.after(()=>db.close());const store=new DurableStore(db)
 const resource=await store.create('owner','test','shutdown',{});await store.enqueue('owner',resource.id,'test','shutdown',{})
 const entered=deferred(),late=deferred();let held
 const worker=new DurableWorker(store,async ctx=>{held=ctx.job;await store.checkpoint(ctx.job,'provider','hash',{answer:'already paid'});entered.resolve();await late.promise;await store.commit(ctx.job,()=>({wrong:true}))},1,()=>{},{maintenanceDelayMs:60_000,maintenanceRetryMs:60_000,drainMs:5})
 worker.start();await entered.promise;await worker.stop()
 const next=await store.claim();assert.equal(next.id,held.id);assert.ok(next.fence>held.fence);assert.equal(next.attempts,0);assert.equal(next.resume_count,0);assert.equal(next.checkpoints.provider.value.answer,'already paid')
 assert.equal(await store.release(held),false);await store.commit(next,()=>({correct:true}));late.resolve();await turn()
 assert.deepEqual((await store.snapshot('owner',resource.id)).data,{correct:true})
 assert.equal(await store.release(next),false)
})
test('shutdown cannot resurrect cancellation and also releases a claim arriving during stop',async t=>{
 const db=await openDatabase();await migrate(db);t.after(()=>db.close());const store=new DurableStore(db)
 const r=await store.create('owner','test','race',{});await store.enqueue('owner',r.id,'test','race',{});const job=await store.claim()
 await store.cancel('owner',r.id);assert.equal(await store.release(job),false);assert.equal(await store.claim(),undefined)
 const claimed=deferred(),begin=deferred();let released=false,called=false
 const worker=new DurableWorker({claim:async()=>{begin.resolve();return claimed.promise},release:async j=>{assert.equal(j.id,'late');released=true}},async()=>{called=true},1,()=>{})
 worker.wake();await begin.promise;const stopping=worker.stop();claimed.resolve({id:'late'});await stopping
 assert.equal(released,true);assert.equal(called,false)
})

test('shutdown stops lease heartbeats even when a provider ignores abort',async t=>{
 t.mock.timers.enable({apis:['setTimeout','setInterval']})
 const entered=deferred(),late=deferred();let renewals=0,claimed=false
 const job={id:'ignored-abort',kind:'test',checkpoints:{},activities:[]}
 const store={db:{query:async()=>[]},claim:async()=>{if(claimed)return;claimed=true;return job},renew:async()=>{renewals++;return true},onCancel:()=>()=>{},release:async()=>true}
 const worker=new DurableWorker(store,async()=>{entered.resolve();await late.promise},1,()=>{},{maintenanceDelayMs:60_000,maintenanceRetryMs:60_000,drainMs:5})
 worker.start();await entered.promise;const stopping=worker.stop();await turn();t.mock.timers.tick(5);await stopping
 const before=renewals;t.mock.timers.tick(100_000);await turn();assert.equal(renewals,before)
 late.resolve();await turn()
})
