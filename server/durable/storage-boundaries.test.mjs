import test from 'node:test'
import assert from 'node:assert/strict'
import {openDatabase,migrate} from './database.ts'
import {DurableStore} from './store.ts'
import {DurableWorker} from './worker.ts'
import {createProductApp} from './http.ts'
import {verifyEventCAS} from './storage-cases.mjs'
import {sharedHttpRateLimitStore} from './http-rate-limit.ts'

test('PGlite events reject stale revisions without a caller lock and roll back sequence conflicts',async()=>{
 const db=await openDatabase();try{await migrate(db);await verifyEventCAS(db)}finally{await db.close()}
})
test('HTTP buckets are shared by API instances, survive recreation, and expire using database time',async()=>{
 const db=await openDatabase(),apps=[]
 try{
  await migrate(db)
  const app=async now=>{const store=new DurableStore(db,()=>now),worker=new DurableWorker(store,async()=>{},1,()=>{});const instance=await createProductApp({store,worker,identity:{production:false},providersReady:true,requestLimit:3});apps.push(instance);return instance}
  const first=await app(1),second=await app(9e14)
  const statuses=await Promise.all(Array.from({length:20},(_,i)=>(i%2?first:second).inject({url:'/api/auth/config',remoteAddress:'192.0.2.1'}).then(r=>r.statusCode)))
  assert.equal(statuses.filter(s=>s===200).length,3);assert.equal(statuses.filter(s=>s===429).length,17)
  const third=await app(4);assert.equal((await third.inject({url:'/api/auth/config',remoteAddress:'192.0.2.1'})).statusCode,429)
  assert.equal((await third.inject({url:'/api/auth/config',remoteAddress:'192.0.2.2'})).statusCode,200)
  const buckets=await db.query('SELECT * FROM tp_http_limits');assert.ok(!JSON.stringify(buckets).includes('192.0.2'))
  await new DurableStore(db,()=>9e14).maintain()
  assert.equal((await third.inject({url:'/api/auth/config',remoteAddress:'192.0.2.1'})).statusCode,429,'a fast API clock must not delete a live database window')
  await db.query('UPDATE tp_http_limits SET expires_at=0')
  assert.equal((await third.inject({url:'/api/auth/config',remoteAddress:'192.0.2.1'})).statusCode,200)
  const store=new DurableStore(db);await store.maintain();assert.equal((await db.query('SELECT * FROM tp_http_limits')).length,1)
 }finally{await Promise.all(apps.map(app=>app.close()));await db.close()}
})
test('shared limit storage errors reject API admission while process liveness stays independent',async()=>{
 const store=new DurableStore({query:async()=>{throw Error('private database failure')}}),worker=new DurableWorker(store,async()=>{},1,()=>{})
 const app=await createProductApp({store,worker,identity:{production:false},providersReady:true})
 try{
  const response=await app.inject({url:'/api/auth/config'})
  assert.equal(response.statusCode,503);assert.equal(response.json().code,'HTTP_LIMIT_UNAVAILABLE');assert.ok(!response.body.includes('private'))
  assert.equal((await app.inject({url:'/health'})).statusCode,200)
 }finally{await app.close()}
})

test('stalled shared limits reject promptly and never admit a late database result',async t=>{
 t.mock.timers.enable({apis:['setTimeout']})
 let complete;const pending=new Promise(resolve=>{complete=resolve}),seen=[]
 const Store=sharedHttpRateLimitStore({query:()=>pending})
 new Store().incr('account',(...args)=>seen.push(args),60000)
 t.mock.timers.tick(2500)
 assert.equal(seen.length,1);assert.equal(seen[0][0].code,'HTTP_LIMIT_UNAVAILABLE');assert.equal(seen[0][0].status,503)
 complete([{current:1,ttl:60000}]);await Promise.resolve();await Promise.resolve()
 assert.equal(seen.length,1)
})
