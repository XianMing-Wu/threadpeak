import type {TaskActivity} from '@threadpeak/contracts/task-activity'
import {recordMetric} from './metrics.ts'
import { providerScope } from './provider-scope.ts'
import { CommandError, digest, type DurableStore, type Job, type Resource } from './store.ts'

export class ToolError extends Error {
  code: string; retryable: boolean
  constructor(code: string, retryable = true) { super(code); this.code=code; this.retryable=retryable }
}
/** Wait for every branch so successful checkpoints survive another branch failing. */
export async function settledParallel<T>(tasks: Promise<T>[]): Promise<T[]> {
  const results = await Promise.allSettled(tasks)
  const failed = results.find(result => result.status === 'rejected')
  if (failed?.status === 'rejected') throw failed.reason
  return results.map(result => (result as PromiseFulfilledResult<T>).value)
}
export class TaskContext {
  private pending = new Map<string, Promise<unknown>>()
  private progressChain: Promise<void> = Promise.resolve()
  private lastDraft = 0
  private pendingDraft?: {phase:string;text:string}
  store: DurableStore; job: Job; signal: AbortSignal
  constructor(store: DurableStore, job: Job, signal: AbortSignal) { this.store=store; this.job=job; this.signal=signal }
  async step<T>(name: string, input: unknown, work: () => Promise<T>): Promise<T> {
    this.signal.throwIfAborted()
    const hash = digest({ version: '2026-09-06.1', input })
    const old = this.job.checkpoints[name]
    if (old) { if (old.hash !== hash) throw new ToolError('CHECKPOINT_VERSION_CONFLICT', false); await recordMetric(this.store.db,this.job,name,{kind:'step',durationMs:0,cache:'checkpoint'});return structuredClone(old.value) as T }
    const pending = this.pending.get(name)
    if (pending) return pending as Promise<T>
    const started=Date.now()
    let outcome='completed',failureCode:string|undefined
    const task = (async () => {
      const value = await providerScope.run({ownerId:this.job.owner_id,jobId:this.job.id,step:name,queue:async detail=>{
        const activity=this.job.activities?.find(a=>a.id===name.split('@')[0])
        if(activity)await this.activity(activity.id,activity.kind,activity.title,'running',detail)
      }},work)
      this.signal.throwIfAborted()
      await this.store.checkpoint(this.job, name, hash, value)
      return value
    })()
    this.pending.set(name, task)
    try { return await task } catch(error) {
      outcome='failed';failureCode=classifyTaskError(error,this.signal.aborted).code
      const id=name.startsWith('L-answer:attach')?'answer:attach':name.startsWith('L-answer:compose')?'answer:write':name.startsWith('memory:')?`context:summary:${name.slice('memory:'.length)}`:name.split('@')[0]
      const activity=this.job.activities?.find(a=>a.id===id)
      if(activity&&!this.signal.aborted&&error instanceof ToolError){
        const detail=error.code==='ZHIHU_RATE_LIMITED'?'知乎请求频率受限，等待冷却后重试':error.code==='RATE_LIMITED'?'模型请求频率受限，等待重试':/QUOTA/.test(error.code)?'服务额度不足，请检查对应账号的额度':/AUTH_INVALID|PROVIDER_AUTH/.test(error.code)?'服务连接认证失败，需要检查配置':/(?:^|_)HTTP_429$/.test(error.code)?'请求频率受限，等待重试':error.code==='STRUCTURE_NOT_SETTLED'?'内容格式校验尚未通过，已保留正文与前面进度':'服务暂时未响应，已保留前面进度'
        await this.activity(activity.id,activity.kind,activity.title,'waiting',detail)
      }
      throw error
    } finally { this.pending.delete(name);await recordMetric(this.store.db,this.job,name,{kind:'step',durationMs:Date.now()-started,result:outcome,code:failureCode,cache:'miss'}) }
  }
  async progress(phase: string, draft?: string, update?: (resource: Resource) => unknown) {
    this.signal.throwIfAborted()
    if(draft!==undefined)this.pendingDraft=undefined
    this.progressChain = this.progressChain.then(() => this.store.progress(this.job, phase, draft, update))
    return this.progressChain
  }
  async activity(id:string,kind:TaskActivity['kind'],title:string,status:TaskActivity['status']='running',detail?:string) {
    this.signal.throwIfAborted()
    this.progressChain=this.progressChain.then(()=>this.store.activity(this.job,{id,kind,title,status,detail}))
    return this.progressChain
  }
  draft(phase: string, text: string) {
    if(!text.trim())return
    this.pendingDraft={phase,text}
    if (Date.now()-this.lastDraft < 150) return
    this.lastDraft = Date.now()
    // Keep an awaited chain: a background draft cannot overwrite a completed task.
    void this.progress(phase, text).catch(() => {})
  }
  async flush() {
    const pending=this.pendingDraft
    if(pending)await this.progress(pending.phase,pending.text)
    await this.progressChain
  }
}
export type TaskHandler = (ctx: TaskContext) => Promise<void>
/** Classify transport failures without treating application TypeErrors as transient. */
export function classifyTaskError(error: unknown, aborted = false): {code:string;retryable:boolean} {
  if (aborted) return {code:'CANCELLED',retryable:false}
  if (error instanceof ToolError) return {code:error.code,retryable:error.retryable}
  if (error instanceof CommandError) return {code:error.code,retryable:false}
  const failure = error as {name?:string;code?:string;message?:string;cause?:{code?:string}}
  const code = failure?.code ?? failure?.cause?.code ?? ''
  if (/^(ECONNRESET|ECONNREFUSED|EPIPE|ETIMEDOUT|EAI_AGAIN|UND_ERR_CONNECT_TIMEOUT|UND_ERR_SOCKET|CONNECTION_CLOSED|CONNECTION_ENDED|CONNECT_TIMEOUT|40001|40P01|53300|57P01|57P02|57P03|08[0-9A-Z]{3})$/.test(code)) return {code:'TRANSIENT_SERVICE_ERROR',retryable:true}
  if (failure?.name==='TimeoutError'||failure?.name==='AbortError') return {code:'PROVIDER_TIMEOUT',retryable:true}
  if (failure?.name==='TypeError' && /^(fetch failed|Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.)$/.test(failure.message??'')) return {code:'NETWORK_UNAVAILABLE',retryable:true}
  return {code:'INTERNAL_ERROR',retryable:false}
}
export class DurableWorker {
  private controllers = new Map<string, AbortController>()
  private jobs = new Map<string, Job>()
  private stopped = false
  private timer?: ReturnType<typeof setTimeout>
  private pumping = false
  private maintenanceTimer?: ReturnType<typeof setTimeout>
  private maintenanceTask?: Promise<void>
  private maintenanceFailures = 0
  private pumpTask?: Promise<void>
  private tasks = new Set<Promise<void>>()
  private timing:{maintenanceDelayMs:number;maintenanceRetryMs:number;drainMs:number}
  store: DurableStore; handler: TaskHandler; concurrency: number; log: (value: unknown) => void
  constructor(store: DurableStore, handler: TaskHandler, concurrency = 4, log = (value: unknown) => { process.stdout.write(JSON.stringify(value)+'\n') }, timing={maintenanceDelayMs:60_000,maintenanceRetryMs:60_000,drainMs:10_000}) { this.store=store; this.handler=handler; this.concurrency=concurrency; this.log=log;this.timing=timing }
  start() { this.stopped = false; this.wake(); if(!this.maintenanceTimer&&!this.maintenanceTask)this.scheduleMaintenance(this.timing.maintenanceDelayMs) }
  private scheduleMaintenance(delay:number) {
    if(this.stopped)return
    this.maintenanceTimer=setTimeout(()=>{
      this.maintenanceTimer=undefined
      this.maintenanceTask=this.maintain().finally(()=>{this.maintenanceTask=undefined})
    },delay)
  }
  private async maintain() {
    let delay=3_600_000
    try { const started=Date.now(),result=await this.store.maintain();this.log({event:'worker.maintenance',durationMs:Date.now()-started,...result});if(result?.more)delay=60_000;this.maintenanceFailures=0 }
    catch(error) {
      delay=Math.min(900_000,this.timing.maintenanceRetryMs*2**Math.min(this.maintenanceFailures++,4))
      this.log({event:'worker.maintenance_failed',...storageFailure(error),retryInMs:delay})
    }
    finally { this.scheduleMaintenance(delay) }
  }
  wake() {
    if (this.stopped || this.pumping) return
    if (this.timer) clearTimeout(this.timer)
    this.pumpTask=this.pump()
  }
  private async pump() {
    this.pumping = true
    try {
      while (!this.stopped && this.controllers.size < this.concurrency) {
        const job = await this.store.claim()
        if (!job) break
        if(this.stopped){await this.store.release(job);break}
        const task = this.execute(job)
        this.tasks.add(task); void task.finally(() => this.tasks.delete(task))
      }
    } catch(error) { this.log({ event: 'worker.storage_unavailable',...storageFailure(error) }) }
    finally { this.pumping = false; if (!this.stopped) this.timer = setTimeout(() => this.wake(), 500) }
  }
  async execute(job: Job) {
    const controller = new AbortController(), start = Date.now()
    this.controllers.set(job.id, controller)
    this.jobs.set(job.id,job)
    const unsubscribe = this.store.onCancel(id => { if(id===job.id) controller.abort() })
    const heartbeat = setInterval(() => { void this.store.renew(job).then(ok => { if (!ok) controller.abort() }).catch(() => controller.abort()) }, 5000)
    controller.signal.addEventListener('abort',()=>{clearInterval(heartbeat);unsubscribe()},{once:true})
    const ctx = new TaskContext(this.store, job, controller.signal)
    let outcome='completed',failureCode:string|undefined
    try {
      // Cancellation or takeover may occur between claim and handler dispatch.
      if(!await this.store.renew(job))controller.abort()
      controller.signal.throwIfAborted()
      await this.handler(ctx)
      await ctx.flush()
      this.log({ event: 'task.completed', jobId: job.id, kind: job.kind, durationMs: Date.now()-start, attempt: job.attempts })
    } catch (error) {
      const {code,retryable} = classifyTaskError(error,controller.signal.aborted)
      outcome=controller.signal.aborted?'cancelled':'failed';failureCode=code
      if (!controller.signal.aborted && code !== 'LEASE_LOST') {
        try { await ctx.flush() } catch { /* storage recovery below */ }
        try { await this.store.recover(job, code, retryable) } catch { /* expired lease is recovered by the next worker */ }
      }
      this.log({ event: 'task.interrupted', jobId: job.id, kind: job.kind, code, durationMs: Date.now()-start, attempt: job.attempts })
    } finally { clearInterval(heartbeat); unsubscribe(); this.controllers.delete(job.id); this.jobs.delete(job.id);await recordMetric(this.store.db,job,job.kind,{kind:'task',durationMs:Date.now()-start,ageAtStartMs:Math.max(0,start-job.created_at),attempt:job.attempts,result:outcome,code:failureCode}) }
  }
  async stop() {
    this.stopped = true; if (this.timer) clearTimeout(this.timer)
    if(this.maintenanceTimer)clearTimeout(this.maintenanceTimer)
    this.maintenanceTimer=undefined
    const jobs=[...this.jobs.values()]
    for (const controller of this.controllers.values()) controller.abort()
    await Promise.all(jobs.map(async job=>{try{await this.store.release(job)}catch(error){this.log({event:'worker.release_failed',jobId:job.id,...storageFailure(error)})}}))
    await this.pumpTask
    // A provider that ignores abort cannot hold deployment open indefinitely.
    // Fencing above prevents it from publishing after another worker takes over.
    let deadline:ReturnType<typeof setTimeout>|undefined
    await Promise.race([Promise.allSettled([...this.tasks,...(this.maintenanceTask?[this.maintenanceTask]:[])]),new Promise<void>(resolve=>{deadline=setTimeout(resolve,this.timing.drainMs)})])
    if(deadline)clearTimeout(deadline)
  }
}

function storageFailure(error:unknown) {
  const value=error as {code?:unknown;name?:unknown;cause?:{code?:unknown}}|undefined
  const code=value?.code??value?.cause?.code
  return {code:typeof code==='string'&&/^[A-Z0-9_]{2,60}$/.test(code)?code:'STORAGE_ERROR',errorType:typeof value?.name==='string'&&/^[A-Za-z]{1,40}$/.test(value.name)?value.name:'Error'}
}
