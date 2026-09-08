import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {DurableStore} from './store.ts'
export async function verifyEventCAS(db){
 const store=new DurableStore(db),owner='cas-test:'+randomUUID(),r=await store.create(owner,'test','scope',{original:true})
 const copies=await Promise.all([store.resource(owner,r.id),store.resource(owner,r.id)])
 const results=await Promise.allSettled(copies.map((copy,i)=>store.event(db,copy,'edited',{i},{winner:i})))
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
 assert.equal(results.find(r=>r.status==='rejected').reason.code,'REVISION_CONFLICT')
 const snapshot=await store.snapshot(owner,r.id),events=await store.events(owner,r.id,0)
 assert.equal(snapshot.revision,1);assert.equal(events.length,1);assert.equal(snapshot.data.winner,events[0].payload.i)
 const corrupt=await store.create(owner,'test','corrupt',{original:true})
 await db.query("INSERT INTO tp_events(resource_id,sequence,kind,payload,created_at) VALUES($1,1,'injected','{}',0)",[corrupt.id])
 await assert.rejects(store.event(db,corrupt,'edited',{},{}),e=>e.code==='EVENT_SEQUENCE_CONFLICT')
 assert.equal(corrupt.revision,0);assert.deepEqual((await store.snapshot(owner,corrupt.id)).data,{original:true})
 assert.equal((await store.snapshot(owner,corrupt.id)).revision,0)
}
