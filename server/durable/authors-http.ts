import { hydrateLearningGoal } from './learning-goal.ts'
import type { GoalContext } from '../../packages/contracts/src/learning-goal.ts'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { AuthorBriefSchema, AuthorFeedbackSchema } from '../../packages/contracts/src/authors.ts'
import type { LearningState } from '../../packages/contracts/src/learning-v2.ts'
import { CommandError, digest, type DurableStore } from './store.ts'
import type { DurableWorker } from './worker.ts'
import { readAuthorNetwork } from './authors-network.ts'

export function registerAuthorRoutes(app:FastifyInstance,store:DurableStore,worker:DurableWorker,owner:(r:FastifyRequest)=>string,key:(r:FastifyRequest)=>string){
  app.get('/api/v2/authors/network',r=>readAuthorNetwork(store.db,owner(r)))
  app.get('/api/v2/authors/history',async r=>(await store.list(owner(r),'authors')).map(a=>({id:a.id,question:a.body.question,updatedAt:a.updated_at})))
  app.post('/api/v2/authors/search',async request=>{
    const input=AuthorBriefSchema.parse(request.body),own=owner(request),commandKey=key(request)
    const previous=await store.existingCommand(own,commandKey)
    if(previous){
      if(previous.kind!=='authors.search'||digest(previous.input.intent)!==digest(input))throw new CommandError('COMMAND_CONFLICT')
      return store.snapshot(own,previous.resource_id)
    }
    let goalContext:GoalContext|undefined
    let selectedContext:{id:string;title:string;content:string}[]=[],conceptTitle:string|undefined
    if(input.learningId){
      const learning=await hydrateLearningGoal(store,own,input.learningId)
      if(learning.kind!=='learning')throw new CommandError('NOT_FOUND',404)
      const cards=input.selected.map(id=>learning.body.nodes.find(n=>n.id===id))
      if(cards.some(n=>!n))throw new CommandError('MATERIAL_NOT_FOUND',400)
      goalContext=learning.body.goalContext
      selectedContext=cards.map(n=>({id:n!.id,title:n!.title,content:n!.text}));conceptTitle=learning.body.title
    }else if(input.selected.length)throw new CommandError('LEARNING_REQUIRED',400)
    const resource=await store.create(own,'authors',commandKey,{version:3,brief:input,question:input.question,topic:'',topicId:'',needs:[],candidates:[],results:[],unresolved:'',discoveredAt:0})
    // Same key must freeze the original context, even if its cards were edited after acceptance.
    await store.enqueue(own,resource.id,'authors.search',commandKey,{...input,intent:input,selectedContext,conceptTitle,goalContext});worker.wake();return store.snapshot(own,resource.id)
  })
  async function mutate(request:FastifyRequest,input:unknown,action:(tx:DurableStore['db'])=>Promise<void>){
    const own=owner(request),commandKey=key(request),hash=digest(input)
    await store.db.transaction(async tx=>{
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`author-preference:${own}`])
      const [previous]=await tx.query<{input_hash:string}>('SELECT input_hash FROM tp_author_commands WHERE owner_id=$1 AND command_key=$2',[own,commandKey])
      if(previous){if(previous.input_hash!==hash)throw new CommandError('COMMAND_CONFLICT');return}
      await action(tx)
      await tx.query('INSERT INTO tp_author_commands(owner_id,command_key,input_hash) VALUES($1,$2,$3)',[own,commandKey,hash])
    });return readAuthorNetwork(store.db,own)
  }
  app.post('/api/v2/authors/feedback',async request=>{
    const input=AuthorFeedbackSchema.parse(request.body),own=owner(request)
    const network=await readAuthorNetwork(store.db,own),author=network.authors.find(a=>a.id===input.authorId)
    if(!author?.topics.some(t=>t.id===input.topicId)||input.kind==='helpful'&&!author.evidence.some(e=>e.evidenceId===input.evidenceId&&e.uses.some(u=>u.topicId===input.topicId)))throw new CommandError('EVIDENCE_NOT_FOUND',404)
    return mutate(request,input,async tx=>{await tx.query(`INSERT INTO tp_author_preferences(owner_id,author_id,topic_id,evidence_id,kind,value,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(owner_id,author_id,topic_id,evidence_id,kind) DO UPDATE SET value=EXCLUDED.value,updated_at=EXCLUDED.updated_at`,[own,input.authorId,input.topicId,input.kind==='helpful'?input.evidenceId:'',input.kind,input.value,Date.now()])})
  })
  app.post('/api/v2/authors/preferences/clear',request=>mutate(request,{action:'clear'},async tx=>{
    await tx.query('DELETE FROM tp_author_usage WHERE owner_id=$1',[owner(request)])
    await tx.query('DELETE FROM tp_author_preferences WHERE owner_id=$1',[owner(request)])
  }))
  app.post('/api/v2/learning/:id/import-author-source',async request=>{
    const input=z.object({authorId:z.string().min(1),evidenceId:z.string().min(1),depth:z.enum(['fast','deep']).default('fast')}).parse(request.body)
    const own=owner(request),id=(request.params as {id:string}).id,commandKey=key(request)
    const previous=await store.existingCommand(own,commandKey)
    if(previous){
      if(previous.kind!=='learning.import'||previous.resource_id!==id||previous.input.evidence.authorId!==input.authorId||previous.input.evidence.evidenceId!==input.evidenceId||previous.input.depth!==input.depth)throw new CommandError('COMMAND_CONFLICT')
      return store.snapshot(own,id)
    }
    const resource=await hydrateLearningGoal(store,own,id)
    if(resource.kind!=='learning'||!resource.body.nodes.length)throw new CommandError('MATERIAL_NOT_READY',400)
    const network=await readAuthorNetwork(store.db,own),raw=network.authors.find(a=>a.id===input.authorId)?.evidence.find(e=>e.evidenceId===input.evidenceId)
    if(!raw)throw new CommandError('EVIDENCE_NOT_FOUND',404)
    const {uses:_uses,...evidence}=raw
    await store.enqueue(own,id,'learning.import',commandKey,{evidence,depth:input.depth})
    worker.wake();return store.snapshot(own,id)
  })
}
