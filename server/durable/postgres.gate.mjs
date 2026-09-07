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
