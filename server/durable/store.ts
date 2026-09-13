import {recordMetric} from './metrics.ts'
import type {TaskActivity} from '@threadpeak/contracts/task-activity'
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
export type Resource<T = any> = { id: string; owner_id: string; kind: string; scope: string; revision: number; data_revision?:number; body: T; created_at: number; updated_at: number }
export type Job = {
  id: string; owner_id: string; resource_id: string; kind: string; input: any; status: 'queued'|'running'|'waiting'|'completed'|'cancelled';
  activities:TaskActivity[]; command_key: string; input_hash: string; phase: string; draft: string; checkpoints: Record<string, { hash: string; value: unknown }>;
  compacted: boolean; attempts: number; lease_takeovers:number; resume_count: number; resumed_at: number; fence: number; lease_until: number; next_at: number; error_code: string|null; created_at: number; updated_at: number;
}
export type Event = { resource_id: string; sequence: number; kind: string; payload: unknown; created_at: number }
export type JobView = Pick<Job, 'id'|'kind'|'status'|'phase'|'draft'|'attempts'|'updated_at'|'activities'> & { recoverable: boolean; basisIds:string[]; conversationId?:string }
export function jobView(job?: Job, emptySearch = false): JobView|null {
  if (!job) return null
  const { id, kind, status, phase, draft, attempts, updated_at } = job
  return { id, kind, status, phase, draft, attempts, updated_at, activities:job.activities??[], recoverable: (status === 'waiting'||status==='cancelled'||emptySearch&&status==='completed') && !job.compacted && (job.resume_count??0)<MAX_MANUAL_RESUMES, basisIds:job.input.context?.allowedCards?.map((c:any)=>c.id)??[], conversationId:job.input.conversationId??undefined }
}

export const JOB_LEASE_MS = 90_000
export const MAX_JOB_FAILURES = 4
export const MAX_LEASE_TAKEOVERS = 4
export const MAX_MANUAL_RESUMES = 4
const stoppedMessageId=(jobId:string)=>`${jobId}-stopped`

export class DurableStore {
  private changes=new Set<(owner:string,id:string)=>void>()
  onChange(listener:(owner:string,id:string)=>void){this.changes.add(listener);return()=>{this.changes.delete(listener)}}
  private changed(owner:string,id:string){for(const listener of this.changes)listener(owner,id)}
  private cancellations = new Set<(id: string) => void>()
  onCancel(listener: (id: string) => void) { this.cancellations.add(listener); return () => { this.cancellations.delete(listener) } }
  db: Sql; now: () => number
  private materialBudget:{count:number;bytes:number}
  constructor(db: Sql, now = Date.now,materialBudget={count:500,bytes:1024**3}) { this.db=db; this.now=now; this.materialBudget=materialBudget }
  async existingCommand(owner:string,key:string){
    return (await this.db.query<Job>('SELECT * FROM tp_jobs WHERE owner_id=$1 AND command_key=$2',[owner,key]))[0]
  }
  async resource<T = any>(owner: string, id: string, tx = this.db): Promise<Resource<T>> {
    const [row] = await tx.query<Resource<T>>('SELECT * FROM tp_resources WHERE id=$1 AND owner_id=$2', [id, owner])
    if (!row) throw new CommandError('NOT_FOUND', 404)
    return row
  }
  async list(owner: string, kind: string) { return this.db.query<Resource>('SELECT * FROM tp_resources WHERE owner_id=$1 AND kind=$2 ORDER BY updated_at DESC', [owner, kind]) }
  async snapshot(owner: string, id: string, afterData?:number) {
    // One MVCC statement keeps body and job consistent without waiting for a
    // writer's row lock. Two independent READ COMMITTED queries could mix states.
    const [resource]=await this.db.query<Resource & {latest_job:Job|null;empty_search:boolean}>(`SELECT r.id,r.kind,r.revision,r.data_revision,
      CASE WHEN r.data_revision=$3 THEN NULL ELSE r.body END AS body,
      r.kind='learning' AND r.body->>'phase'='empty' AS empty_search,to_jsonb(j) AS latest_job
      FROM tp_resources r LEFT JOIN LATERAL (
        SELECT id,kind,status,phase,draft,attempts,updated_at,activities,compacted,resume_count,
          jsonb_build_object('conversationId',input->'conversationId','context',jsonb_build_object('allowedCards',
            (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',c->'id')),'[]'::jsonb) FROM jsonb_array_elements(COALESCE(input->'context'->'allowedCards','[]'::jsonb)) c))) AS input
        FROM tp_jobs WHERE resource_id=r.id ORDER BY created_at DESC,id DESC LIMIT 1
      ) j ON true WHERE r.id=$1 AND r.owner_id=$2`,[id,owner,afterData??null])
    if(!resource)throw new CommandError('NOT_FOUND',404)
    return { id: resource.id, kind: resource.kind, revision: resource.revision, dataRevision: resource.data_revision??0, ...(resource.body===null?{unchanged:true}:{}), data: resource.body??undefined, job: jobView(resource.latest_job??undefined, resource.empty_search) }
  }
  async lockResource(tx: Sql, owner: string, id: string): Promise<Resource> {
    const [row] = await tx.query<Resource>('SELECT * FROM tp_resources WHERE id=$1 AND owner_id=$2 FOR UPDATE', [id, owner])
    if (!row) throw new CommandError('NOT_FOUND', 404)
    return row
  }
  async event(tx: Sql, resource: Resource, kind: string, payload: unknown, body = resource.body, persistBody=true) {
    let rows:{sequence:number}[]
    try{
      rows=await tx.query<{sequence:number}>(`WITH changed AS (
        UPDATE tp_resources SET revision=revision+1,updated_at=$4${persistBody?',data_revision=revision+1,body=$7::jsonb':''}
        WHERE id=$1 AND owner_id=$2 AND revision=$3 RETURNING id,revision
      ) INSERT INTO tp_events(resource_id,sequence,kind,payload,created_at)
        SELECT id,revision,$5,$6::jsonb,$4 FROM changed RETURNING sequence`,
      [resource.id,resource.owner_id,resource.revision,this.now(),kind,JSON.stringify(payload),...(persistBody?[JSON.stringify(body)]:[])])
    }catch(error){
      const failure=error as {code?:string;constraint?:string;constraint_name?:string}
      if(failure.code==='23505'&&(failure.constraint??failure.constraint_name)==='tp_events_pkey')throw new CommandError('EVENT_SEQUENCE_CONFLICT')
      throw error
    }
    if(!rows.length)throw new CommandError('REVISION_CONFLICT')
    resource.revision=rows[0]!.sequence
    if(persistBody){resource.body=body;resource.data_revision=resource.revision}
  }
  async create(owner: string, kind: string, scope: string, body: unknown) {
    const insert=async(tx:Sql)=>{
      if(kind==='attachment'){
        await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`${owner}:materials`])
        const [old]=await tx.query<Resource>('SELECT * FROM tp_resources WHERE owner_id=$1 AND kind=$2 AND scope=$3',[owner,kind,scope]);if(old)return old
        // Imported text can grow to 2M UTF-16 units; reserve 8 MiB before the import starts.
        const bytes=Math.max(Number((body as any).bytes)||0,(body as any).origin==='upload'?0:8*1024**2)
        const [used]=await tx.query<{count:number;bytes:number}>(`SELECT count(*)::integer AS count,COALESCE(sum(GREATEST(COALESCE((body->>'bytes')::bigint,0),CASE WHEN body->>'origin'='upload' THEN 0 ELSE 8388608 END)),0)::bigint AS bytes FROM tp_resources WHERE owner_id=$1 AND kind='attachment'`,[owner])
        if(used!.count>=this.materialBudget.count||used!.bytes+bytes>this.materialBudget.bytes)throw new CommandError('MATERIAL_QUOTA_EXCEEDED',429)
      }
      const id=randomUUID(),now=this.now()
      await tx.query('INSERT INTO tp_resources(id,owner_id,kind,scope,body,created_at,updated_at) VALUES($1,$2,$3,$4,$5::jsonb,$6,$6) ON CONFLICT(owner_id,kind,scope) DO NOTHING',[id,owner,kind,scope,JSON.stringify(body),now])
      const [row]=await tx.query<Resource>('SELECT * FROM tp_resources WHERE owner_id=$1 AND kind=$2 AND scope=$3',[owner,kind,scope]);return row!
    }
    return kind==='attachment'?this.db.transaction(insert):insert(this.db)
  }

  private async admit(tx: Sql, owner: string, kind: string) {
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [owner])
    const [quota] = await tx.query<{recent:number;active:number}>(`SELECT
      (SELECT COUNT(*)::integer FROM tp_jobs WHERE owner_id=$1 AND created_at>$2 AND kind<>'path.answer') +
      (SELECT COUNT(*)::integer FROM tp_job_resumes WHERE owner_id=$1 AND created_at>$2) AS recent,
      (SELECT COUNT(*)::integer FROM tp_jobs WHERE owner_id=$1 AND status IN ('queued','running')) AS active`, [owner, this.now()-3_600_000])
    if ((kind!=='path.answer' && (quota?.recent??0)>=120) || (quota?.active??0)>=6) throw new CommandError('ACCOUNT_BUSY',429)
  }
  private async enqueueLocked(tx:Sql,resource:Resource,kind:string,key:string,input:unknown,update?:(resource:Resource,jobId:string)=>unknown){
    const owner=resource.owner_id,id=resource.id
    const hash = digest({ resourceId: id, kind, input })
    const [previous] = await tx.query<Job>('SELECT * FROM tp_jobs WHERE owner_id=$1 AND command_key=$2', [owner, key])
    if (previous) {
      if (previous.input_hash !== hash && digest({resourceId:previous.resource_id,kind:previous.kind,input:previous.input})!==hash) throw new CommandError('COMMAND_CONFLICT')
      return previous
    }
    await this.admit(tx, owner, kind)
    const [active] = await tx.query<Job>("SELECT * FROM tp_jobs WHERE resource_id=$1 AND status IN ('queued','running','waiting')", [id])
    if (active) throw new CommandError('BUSY')
    const jobId = randomUUID()
    const body = update ? update(resource, jobId) : resource.body
    const [job] = await tx.query<Job>(`INSERT INTO tp_jobs(id,owner_id,resource_id,command_key,input_hash,kind,input,status,phase,created_at,updated_at)
      VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,'queued','已接收，正在准备',$8,$8) RETURNING *`, [jobId, owner, id, key, hash, kind, JSON.stringify(input), this.now()])
    await this.event(tx, resource, 'job.accepted', { jobId }, body)
    return job!
  }
  async enqueue(owner: string, id: string, kind: string, key: string, input: unknown, update?: (resource: Resource, jobId: string) => unknown) {
    return this.db.transaction(async tx=>this.enqueueLocked(tx,await this.lockResource(tx,owner,id),kind,key,input,update))
  }
  /** Accept immutable answers while the preparation job still owns the resource. */
  async answerPath(owner:string,id:string,key:string,input:unknown,update:(resource:Resource)=>unknown){
    return this.db.transaction(async tx=>{
      const resource=await this.lockResource(tx,owner,id),hash=digest({resourceId:id,kind:'path.answer',input})
      const [receipt]=await tx.query<{input_hash:string}>('SELECT input_hash FROM tp_path_answer_commands WHERE owner_id=$1 AND command_key=$2',[owner,key])
      if(receipt){if(receipt.input_hash!==hash)throw new CommandError('COMMAND_CONFLICT');return}
      if(resource.kind!=='path')throw new CommandError('NOT_FOUND',404)
      const [active]=await tx.query<Job>("SELECT * FROM tp_jobs WHERE resource_id=$1 AND status IN ('queued','running','waiting')",[id])
      if(active&&!['path.start','path.answer'].includes(active.kind))throw new CommandError('BUSY')
      const body=update(resource)
      await tx.query('INSERT INTO tp_path_answer_commands(owner_id,command_key,resource_id,input_hash,created_at) VALUES($1,$2,$3,$4,$5)',[owner,key,id,hash,this.now()])
      await this.event(tx,resource,'path.answer.saved',{},body)
      const set=resource.body.questionSets.find((s:any)=>s.status==='active')
      const answered=set?.questions.every((q:any)=>set.selectedOptionIds[q.id]||set.customAnswers?.[q.id])
      if(!active&&resource.body.research?.ready&&answered)await this.enqueueLocked(tx,resource,'path.answer',key,input)
    })
  }
  async claim(leaseMs = JOB_LEASE_MS, excludedIds:string[]=[]): Promise<Job|undefined> {
    return this.db.transaction(async tx => {
      const [job] = await tx.query<Job>(`SELECT * FROM tp_jobs WHERE ((status='queued' AND next_at<=$1) OR (status='running' AND lease_until<$1)) AND NOT (id=ANY($2::text[]))
        ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1`, [this.now(),excludedIds])
      if (!job) return
      const takeovers=(job.lease_takeovers??0)+(job.status==='running'?1:0)
      if(takeovers>=MAX_LEASE_TAKEOVERS){
        // Never wait on a resource while holding the job: cancellation takes the reverse order.
        const [resource]=await tx.query<Resource>('SELECT * FROM tp_resources WHERE id=$1 FOR UPDATE SKIP LOCKED',[job.resource_id]);if(!resource)return
        await tx.query("UPDATE tp_jobs SET status='waiting',fence=fence+1,lease_takeovers=$2,lease_until=0,error_code='LEASE_TAKEOVER_LIMIT',phase='任务多次中断，已有进度已保留，请检查后继续',updated_at=$3 WHERE id=$1",[job.id,takeovers,this.now()])
        await this.event(tx,resource,'job.waiting',{jobId:job.id,code:'LEASE_TAKEOVER_LIMIT'},resource.body,false)
        return
      }
      const [claimed] = await tx.query<Job>(`UPDATE tp_jobs SET status='running',fence=fence+1,lease_takeovers=$4,lease_until=$2,updated_at=$3 WHERE id=$1 RETURNING *`, [job.id, this.now()+leaseMs, this.now(),takeovers])
      return claimed
    })
  }
  async renew(job: Job, leaseMs = JOB_LEASE_MS) {
    const rows = await this.db.query("UPDATE tp_jobs SET lease_until=$3 WHERE id=$1 AND fence=$2 AND status='running' RETURNING id", [job.id, job.fence, this.now()+leaseMs])
    return rows.length === 1
  }
  async release(job:Job) {
    return this.db.transaction(async tx=>{
      const resource=await this.lockResource(tx,job.owner_id,job.resource_id)
      const rows=await tx.query("UPDATE tp_jobs SET status='queued',fence=fence+1,lease_until=0,next_at=0,phase='正在继续',updated_at=$3 WHERE id=$1 AND fence=$2 AND status='running' RETURNING id",[job.id,job.fence,this.now()])
      if(rows.length)await this.event(tx,resource,'job.released',{jobId:job.id},resource.body,false)
      return rows.length===1
    })
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
      // Token deltas live in the lightweight job snapshot. Emit only phase/body changes.
      if(update||phase!==live.phase)await this.event(tx, resource, 'job.progress', { jobId: job.id, phase }, update ? update(resource) : resource.body,!!update)
    })
    this.changed(job.owner_id,job.resource_id)
  }
  async activity(job:Job, input:Pick<TaskActivity,'id'|'kind'|'title'|'status'|'detail'|'thought'|'step'>) {
    await this.db.transaction(async tx=>{
      const resource=await this.lockResource(tx,job.owner_id,job.resource_id),live=await this.ownedJob(tx,job)
      const activities=live.activities??[],old=activities.find(a=>a.id===input.id)
      // Completed checkpoints keep their original completed status on recovery.
      if(old?.status==='done'&&(input.status==='running'||input.kind!=='think'&&old.title===input.title&&old.detail===input.detail))return
      const now=this.now(),activity={...old,...input,startedAt:old?.startedAt??now,updatedAt:now,finishedAt:input.status==='done'?now:undefined}
      if(old)activities[activities.indexOf(old)]=activity;else activities.push(activity)
      const phase=input.status==='running'&&input.kind!=='think'?input.title:live.phase
      await tx.query('UPDATE tp_jobs SET activities=$2::jsonb,phase=$3,updated_at=$4 WHERE id=$1',[job.id,JSON.stringify(activities),phase,now])
      job.activities=activities
      // Reasoning is private presentation data in the owner-scoped snapshot, not
      // a diagnostic/event log and never a formal answer or checkpoint value.
      const {thought:_thought,...eventActivity}=activity
      await this.event(tx,resource,'job.activity',{jobId:job.id,activity:eventActivity},resource.body,false)
    })
    this.changed(job.owner_id,job.resource_id)
  }
  async commit(job: Job, update: (resource: Resource, tx: Sql) => unknown|Promise<unknown>, continuation?:(body:any)=>{kind:string;key:string;input:unknown}|undefined) {
    const started=Date.now()
    await this.db.transaction(async tx => {
      const resource = await this.lockResource(tx, job.owner_id, job.resource_id)
      const live=await this.ownedJob(tx, job)
      const body = await update(resource, tx)
      const activities=(live.activities??[]).map(a=>a.status==='running'?{...a,status:'done',finishedAt:this.now(),updatedAt:this.now()}:a)
      await tx.query('UPDATE tp_jobs SET activities=$2::jsonb WHERE id=$1',[job.id,JSON.stringify(activities)])
      await tx.query("UPDATE tp_jobs SET status='completed',phase='已完成',draft='',lease_until=0,error_code=NULL,updated_at=$2 WHERE id=$1", [job.id, this.now()])
      await this.event(tx, resource, 'job.completed', { jobId: job.id }, body)
      const next=continuation?.(body)
      if(next)await this.enqueueLocked(tx,resource,next.kind,next.key,next.input)
    })
    this.changed(job.owner_id,job.resource_id)
    await recordMetric(this.db,job,'commit',{kind:'commit',durationMs:Date.now()-started})
  }
  async recover(job: Job, code: string, retryable: boolean) {
    await this.db.transaction(async tx => {
      const resource = await this.lockResource(tx, job.owner_id, job.resource_id)
      const live = await this.ownedJob(tx, job)
      const failures = live.attempts + 1
      const retry = retryable && failures < MAX_JOB_FAILURES
      const phase=retry?(/RATE_LIMITED|(?:^|_)HTTP_429$/.test(code)?'请求频率受限，正在等待重试':'服务暂时未响应，正在重试'):'暂时还没完成，内容已保留'
      await tx.query('UPDATE tp_jobs SET status=$2,phase=$3,error_code=$4,next_at=$5,lease_until=0,updated_at=$6,attempts=$7 WHERE id=$1', [job.id, retry?'queued':'waiting', phase, code, this.now()+Math.min(30_000, 1000*2**failures), this.now(), failures])
      await this.event(tx, resource, retry?'job.recovering':'job.waiting', { jobId: job.id })
    })
    this.changed(job.owner_id,job.resource_id)
  }
  async cancel(owner: string, id: string) {
    const cancelled: string[] = []
    await this.db.transaction(async tx => {
      const resource = await this.lockResource(tx, owner, id)
      const jobs = await tx.query<Job>("UPDATE tp_jobs SET status='cancelled',fence=fence+1,phase='已停止',lease_until=0,updated_at=$2 WHERE resource_id=$1 AND status IN ('queued','running','waiting') RETURNING *", [id, this.now()])
      if (!jobs.length) return
      const job = jobs[0]!
      cancelled.push(job.id)
      if (resource.kind === 'learning' && job.input.conversationId) {
        const conversation = resource.body.conversations.find((c: any) => c.id === job.input.conversationId)
        if (conversation && job.draft) conversation.messages.push({ id: stoppedMessageId(job.id), role: 'assistant', text: job.draft, incomplete: true })
      }
      if(resource.kind==='chat'&&job.draft)resource.body.messages.push({id:stoppedMessageId(job.id),role:'assistant',text:job.draft,incomplete:true})
      await this.event(tx, resource, 'job.cancelled', { jobId: job.id })
    })
    for (const jobId of cancelled) for (const notify of this.cancellations) notify(jobId)
  }
  async resume(owner: string, id: string) {
    await this.db.transaction(async tx => {
      const resource = await this.lockResource(tx, owner, id)
      const [latest]=await tx.query<Job>('SELECT * FROM tp_jobs WHERE resource_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1',[id])
      if (!latest) return
      const restartEmpty=latest.status==='completed'&&latest.kind==='learning.enter'&&resource.kind==='learning'&&resource.body.phase==='empty'
      if (!restartEmpty && !['waiting','cancelled'].includes(latest.status)) return
      if(latest.compacted)throw new CommandError('RETRY_EXPIRED',409)
      if ((latest.resume_count??0)>=MAX_MANUAL_RESUMES) throw new CommandError('RETRY_BUDGET_EXHAUSTED',429)
      if (latest.resumed_at && this.now()-latest.resumed_at<30_000) throw new CommandError('RETRY_COOLDOWN',429)
      // Manual recovery uses the same account admission budget as a new command.
      await this.admit(tx, owner, latest.kind)
      if(restartEmpty){
        // A user-requested fresh search retains every prior checkpoint for audit.
        // Failed searches resume their existing checkpoints instead.
        const checkpoints=Object.fromEntries(Object.entries(latest.checkpoints).map(([key,value])=>[key.startsWith('previous:')?key:`previous:${latest.resume_count+1}:${key}`,value]))
        checkpoints[`previous:${latest.resume_count+1}:activities`]={hash:digest(latest.activities),value:latest.activities}
        await tx.query("UPDATE tp_jobs SET status='waiting',checkpoints=$2::jsonb,activities='[]'::jsonb WHERE id=$1",[latest.id,JSON.stringify(checkpoints)])
        resource.body.phase='searching'
      }
      if(latest.status==='cancelled'){
        await tx.query("UPDATE tp_jobs SET status='waiting' WHERE id=$1",[latest.id])
        if(resource.kind==='chat')resource.body.messages=resource.body.messages.filter((m:any)=>m.id!==stoppedMessageId(latest.id))
        if(resource.kind==='learning')for(const c of resource.body.conversations)c.messages=c.messages.filter((m:any)=>m.id!==stoppedMessageId(latest.id))
      }
      const jobs = await tx.query("UPDATE tp_jobs SET status='queued',attempts=0,lease_takeovers=0,resume_count=resume_count+1,resumed_at=$2,next_at=0,phase='正在继续',updated_at=$2 WHERE resource_id=$1 AND status='waiting' RETURNING id", [id, this.now()])
      if (jobs.length) {
        await tx.query('INSERT INTO tp_job_resumes(job_id,resume_number,owner_id,created_at) VALUES($1,$2,$3,$4)',[latest.id,latest.resume_count+1,owner,this.now()])
        await this.event(tx, resource, 'job.resumed', {})
      }
    })
  }
  async edit(owner: string, id: string, revision: number|undefined, update: (r: Resource) => unknown) {
    await this.db.transaction(async tx => {
      const resource = await this.lockResource(tx, owner, id)
      if (revision!==undefined && resource.revision !== revision) throw new CommandError('REVISION_CONFLICT')
      await this.event(tx, resource, 'resource.edited', {}, update(resource))
    })
    this.changed(owner,id)
  }
  async maintain() {
    const cutoff = this.now()-7*86400_000
    return this.db.transaction(async tx => {
      await tx.query("SET LOCAL lock_timeout = '1s'")
      await tx.query("SET LOCAL statement_timeout = '5s'")
      const removed=await tx.query('DELETE FROM tp_events WHERE (resource_id,sequence) IN (SELECT resource_id,sequence FROM tp_events WHERE created_at<$1 ORDER BY created_at LIMIT 1000 FOR UPDATE SKIP LOCKED) RETURNING sequence', [cutoff])
      // Preserve the idempotency receipt and intent, discard duplicate provider
      // bodies. Path trace needs checkpoint names/counts, never their old texts.
      const jobs=await tx.query<Job>("SELECT * FROM tp_jobs WHERE status='completed' AND updated_at<$1 AND compacted=false FOR UPDATE SKIP LOCKED LIMIT 100",[this.now()-30*86400_000])
      const compacted=jobs.map(job=>{
        const checkpoints=job.kind.startsWith('path.')?Object.fromEntries(Object.entries(job.checkpoints).filter(([key])=>/^(R[1-5]|R-S|R-materials)/.test(key)).map(([key,entry])=>[key,{hash:entry.hash,value:Array.isArray(entry.value)?{count:entry.value.length}:null}])):{}
        const input={intent:job.input.intent,depth:job.input.depth,evidence:job.input.evidence?{authorId:job.input.evidence.authorId,evidenceId:job.input.evidence.evidenceId}:undefined}
        return {id:job.id,input,checkpoints}
      })
      if(compacted.length)await tx.query("UPDATE tp_jobs j SET input=c.input,checkpoints=c.checkpoints,draft='',compacted=true FROM jsonb_to_recordset($1::jsonb) AS c(id text,input jsonb,checkpoints jsonb) WHERE j.id=c.id",[JSON.stringify(compacted)])
      const slots=await tx.query("DELETE FROM tp_provider_slots WHERE (pool,slot) IN (SELECT pool,slot FROM tp_provider_slots WHERE pool LIKE 'direct-cache:%' AND token IS NULL AND lease_until<$1 LIMIT 1000 FOR UPDATE SKIP LOCKED) RETURNING slot",[cutoff])
      const sessions=await tx.query('DELETE FROM tp_sessions WHERE token_hash IN (SELECT token_hash FROM tp_sessions WHERE expires_at<$1 LIMIT 1000 FOR UPDATE SKIP LOCKED) RETURNING token_hash',[this.now()])
      const oauth=await tx.query('DELETE FROM tp_oauth_attempts WHERE state_hash IN (SELECT state_hash FROM tp_oauth_attempts WHERE expires_at<$1 LIMIT 1000 FOR UPDATE SKIP LOCKED) RETURNING state_hash',[this.now()])
      const resumes=await tx.query('DELETE FROM tp_job_resumes WHERE (job_id,resume_number) IN (SELECT job_id,resume_number FROM tp_job_resumes WHERE created_at<$1 LIMIT 1000 FOR UPDATE SKIP LOCKED) RETURNING job_id',[cutoff])
      const limits=await tx.query('DELETE FROM tp_http_limits WHERE key IN (SELECT key FROM tp_http_limits WHERE expires_at<(extract(epoch FROM clock_timestamp())*1000)::bigint ORDER BY expires_at LIMIT 1000 FOR UPDATE SKIP LOCKED) RETURNING key')
      const cache=await tx.query('DELETE FROM tp_provider_cache WHERE (owner_id,cache_key) IN (SELECT owner_id,cache_key FROM tp_provider_cache WHERE expires_at<=$1 ORDER BY expires_at LIMIT 1000 FOR UPDATE SKIP LOCKED) RETURNING cache_key',[this.now()])
      const calls=await tx.query('DELETE FROM tp_provider_calls WHERE id IN (SELECT id FROM tp_provider_calls WHERE created_at<$1 ORDER BY created_at LIMIT 1000 FOR UPDATE SKIP LOCKED) RETURNING id',[cutoff])
      return {removed:{events:removed.length,jobs:jobs.length,slots:slots.length,sessions:sessions.length,oauth:oauth.length,resumes:resumes.length,limits:limits.length,cache:cache.length,calls:calls.length},more:jobs.length===100||[removed,slots,sessions,oauth,resumes,limits,cache,calls].some(rows=>rows.length===1000)}
    })
  }
  async events(owner: string, id: string, after: number) {
    const resource=await this.resource(owner, id)
    const events=await this.db.query<Event>('SELECT * FROM tp_events WHERE resource_id=$1 AND sequence>$2 ORDER BY sequence LIMIT 200', [id, after])
    if((events.length&&events[0]!.sequence!==after+1)||(!events.length&&resource.revision>after))throw new CommandError('EVENT_GAP',409)
    return events
  }
}
