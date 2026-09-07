import type {TaskActivity} from '../../packages/contracts/src/task-activity.ts'
import { createHash, randomUUID } from 'node:crypto'
import type { Sql } from './database.ts'

export function digest(value:unknown):string{
  const canonical=(input:any):any=>Array.isArray(input)?input.map(canonical):input&&typeof input==='object'?Object.fromEntries(Object.keys(input).sort().filter(key=>input[key]!==undefined).map(key=>[key,canonical(input[key])])):input
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
}
export class CommandError extends Error {
  code: string; status: number
  constructor(code: string, status = 409) { super(code); this.code=code; this.status=status }
}
export type Resource<T = any> = { id: string; owner_id: string; kind: string; scope: string; revision: number; body: T; created_at: number; updated_at: number }
export type Job = {
  id: string; owner_id: string; resource_id: string; kind: string; input: any; status: 'queued'|'running'|'waiting'|'completed'|'cancelled';
  activities:TaskActivity[]; command_key: string; input_hash: string; phase: string; draft: string; checkpoints: Record<string, { hash: string; value: unknown }>;
  attempts: number; fence: number; lease_until: number; next_at: number; error_code: string|null; created_at: number; updated_at: number;
}
export type Event = { resource_id: string; sequence: number; kind: string; payload: unknown; created_at: number }
export type JobView = Pick<Job, 'id'|'kind'|'status'|'phase'|'draft'|'attempts'|'updated_at'|'activities'> & { recoverable: boolean; basisIds:string[]; conversationId?:string }
export function jobView(job?: Job): JobView|null {
  if (!job) return null
  const { id, kind, status, phase, draft, attempts, updated_at } = job
  return { id, kind, status, phase, draft, attempts, updated_at, activities:job.activities??[], recoverable: status === 'waiting'||status==='cancelled', basisIds:job.input.context?.allowedCards?.map((c:any)=>c.id)??[], conversationId:job.input.conversationId }
}

export class DurableStore {
  db: Sql; now: () => number
  constructor(db: Sql, now = Date.now) { this.db=db; this.now=now }
  async existingCommand(owner:string,key:string){
    return (await this.db.query<Job>('SELECT * FROM tp_jobs WHERE owner_id=$1 AND command_key=$2',[owner,key]))[0]
  }
  async resource<T = any>(owner: string, id: string, tx = this.db): Promise<Resource<T>> {
    const [row] = await tx.query<Resource<T>>('SELECT * FROM tp_resources WHERE id=$1 AND owner_id=$2', [id, owner])
    if (!row) throw new CommandError('NOT_FOUND', 404)
    return row
  }
  async list(owner: string, kind: string) { return this.db.query<Resource>('SELECT * FROM tp_resources WHERE owner_id=$1 AND kind=$2 ORDER BY updated_at DESC', [owner, kind]) }
  async snapshot(owner: string, id: string) {
    return this.db.transaction(async tx => {
      const resource = await this.lockResource(tx, owner, id)
      const [job] = await tx.query<Job>('SELECT * FROM tp_jobs WHERE resource_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1', [id])
      return { id: resource.id, kind: resource.kind, revision: resource.revision, data: resource.body, job: jobView(job) }
    })
  }
  async lockResource(tx: Sql, owner: string, id: string): Promise<Resource> {
    const [row] = await tx.query<Resource>('SELECT * FROM tp_resources WHERE id=$1 AND owner_id=$2 FOR UPDATE', [id, owner])
    if (!row) throw new CommandError('NOT_FOUND', 404)
    return row
  }
  async event(tx: Sql, resource: Resource, kind: string, payload: unknown, body = resource.body, persistBody=true) {
    resource.revision++
    resource.body = body
    if(persistBody)await tx.query('UPDATE tp_resources SET revision=$2,body=$3::jsonb,updated_at=$4 WHERE id=$1', [resource.id, resource.revision, JSON.stringify(body), this.now()])
    else await tx.query('UPDATE tp_resources SET revision=$2,updated_at=$3 WHERE id=$1',[resource.id,resource.revision,this.now()])
    await tx.query('INSERT INTO tp_events(resource_id,sequence,kind,payload,created_at) VALUES($1,$2,$3,$4::jsonb,$5)', [resource.id, resource.revision, kind, JSON.stringify(payload), this.now()])
  }
  async create(owner: string, kind: string, scope: string, body: unknown) {
    const id = randomUUID(), now = this.now()
    await this.db.query('INSERT INTO tp_resources(id,owner_id,kind,scope,body,created_at,updated_at) VALUES($1,$2,$3,$4,$5::jsonb,$6,$6) ON CONFLICT(owner_id,kind,scope) DO NOTHING', [id, owner, kind, scope, JSON.stringify(body), now])
    const [row] = await this.db.query<Resource>('SELECT * FROM tp_resources WHERE owner_id=$1 AND kind=$2 AND scope=$3', [owner, kind, scope])
    return row!
  }
  async enqueue(owner: string, id: string, kind: string, key: string, input: unknown, update?: (resource: Resource, jobId: string) => unknown) {
    return this.db.transaction(async tx => {
      const resource = await this.lockResource(tx, owner, id)
      const hash = digest({ resourceId: id, kind, input })
      const [previous] = await tx.query<Job>('SELECT * FROM tp_jobs WHERE owner_id=$1 AND command_key=$2', [owner, key])
      if (previous) {
        if (previous.input_hash !== hash && digest({resourceId:previous.resource_id,kind:previous.kind,input:previous.input})!==hash) throw new CommandError('COMMAND_CONFLICT')
        return previous
      }
      // Serialize admission per account, including different workspaces and replicas.
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))',[owner])
      const [quota]=await tx.query<{recent:number;active:number}>(`SELECT
        COUNT(*) FILTER(WHERE created_at>$2 AND kind<>'path.answer')::integer AS recent,
        COUNT(*) FILTER(WHERE status IN ('queued','running'))::integer AS active
        FROM tp_jobs WHERE owner_id=$1`,[owner,this.now()-3_600_000])
      if((kind!=='path.answer'&&(quota?.recent??0)>=120)||(quota?.active??0)>=6)throw new CommandError('ACCOUNT_BUSY',429)
      const [active] = await tx.query<Job>("SELECT * FROM tp_jobs WHERE resource_id=$1 AND status IN ('queued','running','waiting')", [id])
      if (active) throw new CommandError('BUSY')
      const jobId = randomUUID()
      const body = update ? update(resource, jobId) : resource.body
      const [job] = await tx.query<Job>(`INSERT INTO tp_jobs(id,owner_id,resource_id,command_key,input_hash,kind,input,status,phase,created_at,updated_at)
        VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,'queued','已接收，正在准备',$8,$8) RETURNING *`, [jobId, owner, id, key, hash, kind, JSON.stringify(input), this.now()])
      await this.event(tx, resource, 'job.accepted', { jobId }, body)
      return job!
    })
  }
  async claim(leaseMs = 30_000): Promise<Job|undefined> {
    return this.db.transaction(async tx => {
      const [job] = await tx.query<Job>(`SELECT * FROM tp_jobs WHERE (status='queued' AND next_at<=$1) OR (status='running' AND lease_until<$1)
        ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1`, [this.now()])
      if (!job) return
      const [claimed] = await tx.query<Job>(`UPDATE tp_jobs SET status='running',fence=fence+1,attempts=attempts+1,lease_until=$2,updated_at=$3 WHERE id=$1 RETURNING *`, [job.id, this.now()+leaseMs, this.now()])
      return claimed
    })
  }
  async renew(job: Job, leaseMs = 30_000) {
    const rows = await this.db.query("UPDATE tp_jobs SET lease_until=$3 WHERE id=$1 AND fence=$2 AND status='running' AND lease_until>=$4 RETURNING id", [job.id, job.fence, this.now()+leaseMs, this.now()])
    return rows.length === 1
  }
  async ownedJob(tx: Sql, job: Job) {
    const [live] = await tx.query<Job>("SELECT * FROM tp_jobs WHERE id=$1 AND fence=$2 AND status='running' AND lease_until>=$3 FOR UPDATE", [job.id, job.fence, this.now()])
    if (!live) throw new CommandError('LEASE_LOST')
    return live
  }
  async checkpoint(job: Job, name: string, hash: string, value: unknown) {
    await this.db.transaction(async tx => {
      const live = await this.ownedJob(tx, job)
      live.checkpoints[name] = { hash, value }
      await tx.query('UPDATE tp_jobs SET checkpoints=$2::jsonb,updated_at=$3 WHERE id=$1', [job.id, JSON.stringify(live.checkpoints), this.now()])
    })
    job.checkpoints[name] = { hash, value }
  }
  async progress(job: Job, phase: string, draft?: string, update?: (resource: Resource) => unknown) {
    await this.db.transaction(async tx => {
      const resource = await this.lockResource(tx, job.owner_id, job.resource_id)
      const live=await this.ownedJob(tx, job)
      const text=draft??live.draft
      await tx.query('UPDATE tp_jobs SET phase=$2,draft=$3,updated_at=$4 WHERE id=$1', [job.id, phase, text, this.now()])
      job.draft=text
      await this.event(tx, resource, 'job.progress', { jobId: job.id, phase, draft:text }, update ? update(resource) : resource.body,!!update)
    })
  }
  async activity(job:Job, input:Pick<TaskActivity,'id'|'kind'|'title'|'status'|'detail'>) {
    await this.db.transaction(async tx=>{
      const resource=await this.lockResource(tx,job.owner_id,job.resource_id),live=await this.ownedJob(tx,job)
      const activities=live.activities??[],old=activities.find(a=>a.id===input.id)
      // Completed checkpoints keep their original completed status on recovery.
      if(old?.status==='done'&&(input.status==='running'||old.title===input.title&&old.detail===input.detail))return
      const now=this.now(),activity={...old,...input,startedAt:old?.startedAt??now,updatedAt:now,...(input.status==='done'?{finishedAt:now}:{})}
      if(old)activities[activities.indexOf(old)]=activity;else activities.push(activity)
      const phase=input.status==='running'?input.title:live.phase
      await tx.query('UPDATE tp_jobs SET activities=$2::jsonb,phase=$3,updated_at=$4 WHERE id=$1',[job.id,JSON.stringify(activities),phase,now])
      job.activities=activities
      await this.event(tx,resource,'job.activity',{jobId:job.id,activity},resource.body,false)
    })
  }
  async commit(job: Job, update: (resource: Resource, tx: Sql) => unknown|Promise<unknown>) {
    await this.db.transaction(async tx => {
      const resource = await this.lockResource(tx, job.owner_id, job.resource_id)
      const live=await this.ownedJob(tx, job)
      const body = await update(resource, tx)
      const activities=(live.activities??[]).map(a=>a.status==='running'?{...a,status:'done',finishedAt:this.now(),updatedAt:this.now()}:a)
      await tx.query('UPDATE tp_jobs SET activities=$2::jsonb WHERE id=$1',[job.id,JSON.stringify(activities)])
      await tx.query("UPDATE tp_jobs SET status='completed',phase='已完成',draft='',lease_until=0,error_code=NULL,updated_at=$2 WHERE id=$1", [job.id, this.now()])
      await this.event(tx, resource, 'job.completed', { jobId: job.id }, body)
    })
  }
  async recover(job: Job, code: string, retryable: boolean) {
    await this.db.transaction(async tx => {
      const resource = await this.lockResource(tx, job.owner_id, job.resource_id)
      await this.ownedJob(tx, job)
      const retry = retryable && job.attempts < 4
      const phase=retry?(/(?:^|_)HTTP_429$/.test(code)?'服务暂时繁忙，正在等待重试':'服务暂时未响应，正在重试'):'暂时还没完成，内容已保留'
      await tx.query('UPDATE tp_jobs SET status=$2,phase=$3,error_code=$4,next_at=$5,lease_until=0,updated_at=$6 WHERE id=$1', [job.id, retry?'queued':'waiting', phase, code, this.now()+Math.min(30_000, 1000*2**job.attempts), this.now()])
      await this.event(tx, resource, retry?'job.recovering':'job.waiting', { jobId: job.id })
    })
  }
  async cancel(owner: string, id: string) {
    await this.db.transaction(async tx => {
      const resource = await this.lockResource(tx, owner, id)
      const jobs = await tx.query<Job>("UPDATE tp_jobs SET status='cancelled',fence=fence+1,phase='已停止',lease_until=0,updated_at=$2 WHERE resource_id=$1 AND status IN ('queued','running','waiting') RETURNING *", [id, this.now()])
      if (!jobs.length) return
      const job = jobs[0]!
      if (resource.kind === 'learning' && job.input.conversationId) {
        const conversation = resource.body.conversations.find((c: any) => c.id === job.input.conversationId)
        if (conversation && job.draft) conversation.messages.push({ id: `${job.id}-stopped`, role: 'assistant', text: job.draft, incomplete: true })
      }
      if(resource.kind==='chat'&&job.draft)resource.body.messages.push({id:`${job.id}-stopped`,role:'assistant',text:job.draft,incomplete:true})
      await this.event(tx, resource, 'job.cancelled', { jobId: job.id })
    })
  }
  async resume(owner: string, id: string) {
    await this.db.transaction(async tx => {
      const resource = await this.lockResource(tx, owner, id)
      const [latest]=await tx.query<Job>('SELECT * FROM tp_jobs WHERE resource_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1',[id])
      if(latest?.status==='cancelled'){
        await tx.query("UPDATE tp_jobs SET status='waiting' WHERE id=$1",[latest.id])
        if(resource.kind==='chat')resource.body.messages=resource.body.messages.filter((m:any)=>m.id!==`${latest.id}-stopped`)
        if(resource.kind==='learning')for(const c of resource.body.conversations)c.messages=c.messages.filter((m:any)=>m.id!==`${latest.id}-stopped`)
      }
      if(resource.kind==='learning'&&resource.body.phase==='empty'&&latest?.status==='completed'){
        await tx.query("UPDATE tp_jobs SET status='waiting',checkpoints='{}'::jsonb WHERE id=$1",[latest.id])
        resource.body.phase='searching'
      }
      const jobs = await tx.query("UPDATE tp_jobs SET status='queued',attempts=0,next_at=0,phase='正在继续',updated_at=$2 WHERE resource_id=$1 AND status='waiting' RETURNING id", [id, this.now()])
      if (jobs.length) await this.event(tx, resource, 'job.resumed', {})
    })
  }
  async edit(owner: string, id: string, revision: number|undefined, update: (r: Resource) => unknown) {
    await this.db.transaction(async tx => {
      const resource = await this.lockResource(tx, owner, id)
      if (revision!==undefined && resource.revision !== revision) throw new CommandError('REVISION_CONFLICT')
      await this.event(tx, resource, 'resource.edited', {}, update(resource))
    })
  }
  async events(owner: string, id: string, after: number) {
    await this.resource(owner, id)
    return this.db.query<Event>('SELECT * FROM tp_events WHERE resource_id=$1 AND sequence>$2 ORDER BY sequence LIMIT 200', [id, after])
  }
}
