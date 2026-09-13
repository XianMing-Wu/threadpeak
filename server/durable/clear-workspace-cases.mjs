import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {migrate} from './database.ts'
import {DurableStore} from './store.ts'
import {clearWorkspace} from './clear-workspace.ts'
import {workspaceGeneration,workspaceWrites} from './workspace-fence.ts'

export async function verifyWorkspaceClear(db,second=db) {
  await migrate(db)
  const store=new DurableStore(db),otherStore=new DurableStore(second)
  const owner='clear-test:'+randomUUID(),other='clear-test:'+randomUUID()
  const resource=await store.create(owner,'chat','old',{messages:[{text:'private draft'}]})
  const untouched=await store.create(other,'chat','keep',{messages:['keep']})
  const job=await store.enqueue(owner,resource.id,'test','old-command',{question:'old'})
  await db.query('INSERT INTO tp_material_uploads(resource_id,base64) VALUES($1,$2)',[resource.id,'cHJpdmF0ZQ=='])
  await db.query('INSERT INTO tp_memories(owner_id,source_hash,summary,created_at) VALUES($1,$2,$3,$4)',[owner,'hash','private summary',1])
  await db.query('INSERT INTO tp_provider_cache(owner_id,cache_key,body,expires_at) VALUES($1,$2,$3,$4)',[owner,'key','{}',123])
  await db.query('INSERT INTO tp_sessions(token_hash,owner_id,expires_at) VALUES($1,$2,$3)',[randomUUID(),owner,Date.now()+10000])
  const scope={owner,generation:await workspaceGeneration(db,owner)}
  let cancelled=false
  const off=store.onCancel(id=>{if(id===job.id)cancelled=true})
  await clearWorkspace(store,owner,'clear-once')
  off();assert.equal(cancelled,true)
  for(const table of ['tp_resources','tp_jobs','tp_memories','tp_provider_cache','tp_provider_calls','tp_author_network','tp_author_usage'])assert.equal((await db.query(`SELECT * FROM ${table} WHERE owner_id=$1`,[owner])).length,0,table)
  assert.equal((await db.query('SELECT * FROM tp_material_uploads WHERE resource_id=$1',[resource.id])).length,0)
  assert.equal((await db.query('SELECT * FROM tp_sessions WHERE owner_id=$1',[owner])).length,1)
  assert.deepEqual((await store.resource(other,untouched.id)).body,{messages:['keep']})
  // A delayed request on another connection cannot recreate an old resource or cache.
  await assert.rejects(workspaceWrites.run(scope,()=>otherStore.create(owner,'chat','late',{messages:['stale']})),e=>e.code==='WORKSPACE_CLEARED')
  await assert.rejects(workspaceWrites.run(scope,()=>second.query('INSERT INTO tp_memories(owner_id,source_hash,summary,created_at) VALUES($1,$2,$3,$4)',[owner,'late','must not return',1])),e=>e.code==='WORKSPACE_CLEARED')
  const fresh=await workspaceWrites.run({owner,generation:1},()=>otherStore.create(owner,'chat','new',{messages:['new']}))
  await clearWorkspace(store,owner,'clear-once')
  assert.deepEqual((await store.resource(owner,fresh.id)).body,{messages:['new']},'replaying reset must not erase subsequent work')
  assert.equal(await workspaceGeneration(db,owner),1)
  await clearWorkspace(store,owner,'clear-twice')
  assert.equal((await store.list(owner,'chat')).length,0)
  assert.equal(await workspaceGeneration(db,owner),2)
}
