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
  store: DurableStore; job: Job; signal: AbortSignal
  constructor(store: DurableStore, job: Job, signal: AbortSignal) { this.store=store; this.job=job; this.signal=signal }
  async step<T>(name: string, input: unknown, work: () => Promise<T>): Promise<T> {
    this.signal.throwIfAborted()
    const hash = digest({ version: '2026-09-06.1', input })
    const old = this.job.checkpoints[name]
    if (old) { if (old.hash !== hash) throw new ToolError('CHECKPOINT_VERSION_CONFLICT', false); return structuredClone(old.value) as T }
    const pending = this.pending.get(name)
    if (pending) return pending as Promise<T>
    const task = (async () => {
      const value = await work()
      this.signal.throwIfAborted()
      await this.store.checkpoint(this.job, name, hash, value)
      return value
    })()
    this.pending.set(name, task)
    try { return await task } finally { this.pending.delete(name) }
  }
  async progress(phase: string, draft = '', update?: (resource: Resource) => unknown) {
    this.signal.throwIfAborted()
    this.progressChain = this.progressChain.then(() => this.store.progress(this.job, phase, draft, update))
    return this.progressChain
  }
  draft(phase: string, text: string) {
    if (Date.now()-this.lastDraft < 250) return
    this.lastDraft = Date.now()
    // Keep an awaited chain: a background draft cannot overwrite a completed task.
    void this.progress(phase, text).catch(() => {})
  }
  async flush() { await this.progressChain }
}
export type TaskHandler = (ctx: TaskContext) => Promise<void>
export class DurableWorker {
  private controllers = new Map<string, AbortController>()
  private stopped = false
  private timer?: ReturnType<typeof setTimeout>
  private pumping = false
  private tasks = new Set<Promise<void>>()
  store: DurableStore; handler: TaskHandler; concurrency: number; log: (value: unknown) => void
  constructor(store: DurableStore, handler: TaskHandler, concurrency = 4, log = (value: unknown) => { process.stdout.write(JSON.stringify(value)+'\n') }) { this.store=store; this.handler=handler; this.concurrency=concurrency; this.log=log }
  start() { this.stopped = false; this.wake() }
  wake() {
    if (this.stopped || this.pumping) return
    if (this.timer) clearTimeout(this.timer)
    void this.pump()
  }
  private async pump() {
    this.pumping = true
    try {
      while (!this.stopped && this.controllers.size < this.concurrency) {
        const job = await this.store.claim()
        if (!job) break
        const task = this.execute(job)
        this.tasks.add(task); void task.finally(() => this.tasks.delete(task))
      }
    } catch { this.log({ event: 'worker.storage_unavailable' }) }
    finally { this.pumping = false; if (!this.stopped) this.timer = setTimeout(() => this.wake(), 500) }
  }
  async execute(job: Job) {
    const controller = new AbortController(), start = Date.now()
    this.controllers.set(job.id, controller)
    const heartbeat = setInterval(() => { void this.store.renew(job).then(ok => { if (!ok) controller.abort() }).catch(() => controller.abort()) }, 5000)
    const ctx = new TaskContext(this.store, job, controller.signal)
    try {
      await this.handler(ctx)
      await ctx.flush()
      this.log({ event: 'task.completed', jobId: job.id, kind: job.kind, durationMs: Date.now()-start, attempt: job.attempts })
    } catch (error) {
      const code = error instanceof ToolError || error instanceof CommandError ? error.code : controller.signal.aborted ? 'CANCELLED' : 'INTERNAL_ERROR'
      if (!controller.signal.aborted && code !== 'LEASE_LOST') {
        try { await ctx.flush() } catch { /* storage recovery below */ }
        try { await this.store.recover(job, code, error instanceof ToolError ? error.retryable : false) } catch { /* expired lease is recovered by the next worker */ }
      }
      this.log({ event: 'task.interrupted', jobId: job.id, kind: job.kind, code, durationMs: Date.now()-start, attempt: job.attempts })
    } finally { clearInterval(heartbeat); this.controllers.delete(job.id) }
  }
  async stop() {
    this.stopped = true; if (this.timer) clearTimeout(this.timer)
    for (const controller of this.controllers.values()) controller.abort()
    await Promise.allSettled([...this.tasks])
  }
}
