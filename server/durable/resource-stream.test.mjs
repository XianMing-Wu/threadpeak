import test from 'node:test'
import assert from 'node:assert/strict'
import {openDatabase,migrate} from './database.ts'
import {DurableStore} from './store.ts'
import {DurableWorker} from './worker.ts'
import {createProductApp} from './http.ts'

test('live stream is owner scoped, publishes committed deltas and closes cleanly',async t=>{
 const db=await openDatabase();await migrate(db);const store=new DurableStore(db),worker=new DurableWorker(store,async()=>{},1,()=>{})
 const app=await createProductApp({store,worker,identity:{production:false},providersReady:true})
 t.after(async()=>{await app.close();await db.close()})
 const guest=await app.inject({method:'POST',url:'/api/auth/guest'}),cookie=String(guest.headers['set-cookie']).split(';')[0]
 const [{owner_id:owner}]=await db.query('SELECT owner_id FROM tp_sessions')
 const resource=await store.create(owner,'test','live',{body:'original'})
 const other=await store.create('other','test','foreign',{})
 assert.equal((await app.inject({url:`/api/v2/resources/${other.id}/stream`,headers:{cookie}})).statusCode,404)
 const response=await app.inject({url:`/api/v2/resources/${resource.id}/stream`,headers:{cookie},payloadAsStream:true})
 assert.equal(response.statusCode,200);assert.match(response.headers['content-type'],/text\/event-stream/)
 const stream=response.stream();let received=''
 stream.on('data',chunk=>{received+=chunk})
 const wait=async predicate=>{for(let i=0;i<100;i++){if(predicate())return;await new Promise(r=>setTimeout(r,10))}assert.fail('stream update timeout')}
 await wait(()=>received.includes('original'))
 await store.enqueue(owner,resource.id,'test','live-job',{});const job=await store.claim()
 await store.progress(job,'writing','正在输出')
 await wait(()=>received.includes('正在输出'))
 await store.progress(job,'writing','继续输出');await wait(()=>received.includes('继续输出'))
 assert.ok(received.includes('"unchanged":true'));assert.ok(!received.includes(other.id))
 await store.commit(job,()=>({body:'final'}))
 await wait(()=>received.includes('final'))
 stream.destroy()
})
