import {ownPGliteDirectory} from './pglite-owner.ts'
import { mkdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import postgres from 'postgres'

export type Sql = {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>
  transaction<T>(fn: (sql: Sql) => Promise<T>): Promise<T>
  close(): Promise<void>
}

export async function openDatabase(options: { url?: string; directory?: string } = {}): Promise<Sql> {
  if (options.url) {
    const client = postgres(options.url, { max: 10, connect_timeout:5, onnotice: () => {}, types: { serializedJson: { to: 3802, from: [114,3802], serialize: (value: unknown) => typeof value==='string'?value:JSON.stringify(value), parse: (value: string) => JSON.parse(value) }, safeInteger: { to: 20, from: [20], serialize: (value: number) => String(value), parse: (value: string) => { const result=Number(value); if(!Number.isSafeInteger(result))throw new Error('DATABASE_INTEGER_RANGE'); return result } } } })
    function wrap(connection: any, nested = false): Sql {
      let pending: Promise<unknown> = Promise.resolve()
      return {
        async query<T>(sql: string, params: unknown[] = []) { return [...await connection.unsafe(sql, params)] as T[] },
        transaction: (fn) => {
          if(!nested)return connection.begin((tx:any)=>fn(wrap(tx,true)))
          const task=pending.then(()=>connection.savepoint((tx:any)=>fn(wrap(tx,true))))
          pending=task.catch(()=>{});return task
        },
        close: () => client.end(),
      }
    }
    return wrap(client)
  }
  if (options.directory) await mkdir(options.directory, { recursive: true, mode: 0o700 })
  const release=options.directory?await ownPGliteDirectory(options.directory):async()=>{}
  const db = new PGlite(options.directory)
  try{await db.waitReady}catch(error){await release();throw error}
  let savepointId = 0
  function wrap(connection: Pick<PGlite, 'query'>, nested = false): Sql {
    let pending: Promise<unknown> = Promise.resolve()
    return {
      async query<T>(sql: string, params: unknown[] = []) { return (await connection.query<T>(sql, params)).rows },
      transaction: (fn) => {
        if (!nested) return db.transaction(tx => fn(wrap(tx, true)))
        // Nested work stays on the transaction connection. Serialize sibling
        // savepoints so one rollback cannot erase another sibling's result.
        const task = pending.then(async () => {
          const name = `tp_savepoint_${++savepointId}`
          await connection.query(`SAVEPOINT ${name}`)
          try {
            const value = await fn(wrap(connection, true))
            await connection.query(`RELEASE SAVEPOINT ${name}`)
            return value
          } catch (error) {
            await connection.query(`ROLLBACK TO SAVEPOINT ${name}`)
            await connection.query(`RELEASE SAVEPOINT ${name}`)
            throw error
          }
        })
        pending = task.catch(() => {})
        return task
      },
      close: async () => {try{await db.close()}finally{await release()}},
    }
  }
  return wrap(db)
}

export async function migrate(db: Sql) {
  await db.transaction(async (tx) => {
    // One transaction and a database lock make startup migrations safe across workers.
    await tx.query('SELECT pg_advisory_xact_lock(73486219)')
    await tx.query(`CREATE TABLE IF NOT EXISTS tp_schema_migrations (version text PRIMARY KEY, applied_at bigint NOT NULL)` )
    await tx.query(`CREATE TABLE IF NOT EXISTS tp_resources (
      id text PRIMARY KEY, owner_id text NOT NULL, kind text NOT NULL, scope text NOT NULL,
      revision integer NOT NULL DEFAULT 0, body jsonb NOT NULL,
      created_at bigint NOT NULL, updated_at bigint NOT NULL,
      UNIQUE(owner_id, kind, scope))`)
    await tx.query('ALTER TABLE tp_resources ADD COLUMN IF NOT EXISTS data_revision integer NOT NULL DEFAULT 0')
    await tx.query(`CREATE TABLE IF NOT EXISTS tp_jobs (
      id text PRIMARY KEY, owner_id text NOT NULL, resource_id text NOT NULL REFERENCES tp_resources(id),
      command_key text NOT NULL, input_hash text NOT NULL, kind text NOT NULL, input jsonb NOT NULL,
      status text NOT NULL CHECK(status IN ('queued','running','waiting','completed','cancelled')),
      phase text NOT NULL, draft text NOT NULL DEFAULT '', checkpoints jsonb NOT NULL DEFAULT '{}',
      attempts integer NOT NULL DEFAULT 0, fence integer NOT NULL DEFAULT 0,
      lease_until bigint NOT NULL DEFAULT 0, next_at bigint NOT NULL DEFAULT 0,
      error_code text, created_at bigint NOT NULL, updated_at bigint NOT NULL,
      UNIQUE(owner_id, command_key))`)
    await tx.query(`CREATE UNIQUE INDEX IF NOT EXISTS tp_one_active_job ON tp_jobs(resource_id)
      WHERE status IN ('queued','running','waiting')`)
    await tx.query(`CREATE TABLE IF NOT EXISTS tp_path_answer_commands (
      owner_id text NOT NULL, command_key text NOT NULL, resource_id text NOT NULL REFERENCES tp_resources(id),
      input_hash text NOT NULL, created_at bigint NOT NULL, PRIMARY KEY(owner_id,command_key))`)
    await tx.query(`CREATE INDEX IF NOT EXISTS tp_jobs_resource_latest ON tp_jobs(resource_id,created_at DESC,id DESC)`)
    await tx.query(`CREATE INDEX IF NOT EXISTS tp_jobs_owner_recent ON tp_jobs(owner_id,created_at)`)
    await tx.query(`CREATE INDEX IF NOT EXISTS tp_jobs_owner_active ON tp_jobs(owner_id) WHERE status IN ('queued','running')`)
    await tx.query(`CREATE INDEX IF NOT EXISTS tp_jobs_queue ON tp_jobs(status,next_at,lease_until)`)
    await tx.query("CREATE INDEX IF NOT EXISTS tp_jobs_queued_due ON tp_jobs(next_at,created_at) WHERE status='queued'")
    await tx.query("CREATE INDEX IF NOT EXISTS tp_jobs_running_expiry ON tp_jobs(lease_until,created_at) WHERE status='running'")
    await tx.query('ALTER TABLE tp_jobs ADD COLUMN IF NOT EXISTS lease_takeovers integer NOT NULL DEFAULT 0')
    await tx.query('ALTER TABLE tp_jobs ADD COLUMN IF NOT EXISTS compacted boolean NOT NULL DEFAULT false')
    await tx.query("CREATE INDEX IF NOT EXISTS tp_jobs_retention ON tp_jobs(updated_at) WHERE status='completed' AND compacted=false")
    await tx.query('ALTER TABLE tp_jobs ADD COLUMN IF NOT EXISTS resume_count integer NOT NULL DEFAULT 0')
    await tx.query('ALTER TABLE tp_jobs ADD COLUMN IF NOT EXISTS resumed_at bigint NOT NULL DEFAULT 0')
    await tx.query('CREATE INDEX IF NOT EXISTS tp_jobs_owner_resumed ON tp_jobs(owner_id,resumed_at) WHERE resumed_at>0')
    await tx.query(`CREATE TABLE IF NOT EXISTS tp_job_resumes (
      job_id text NOT NULL REFERENCES tp_jobs(id), resume_number integer NOT NULL,
      owner_id text NOT NULL, created_at bigint NOT NULL, PRIMARY KEY(job_id,resume_number))`)
    await tx.query('CREATE INDEX IF NOT EXISTS tp_job_resumes_owner_recent ON tp_job_resumes(owner_id,created_at)')
    await tx.query('CREATE INDEX IF NOT EXISTS tp_job_resumes_retention ON tp_job_resumes(created_at)')
    const [resumeLedger]=await tx.query("SELECT version FROM tp_schema_migrations WHERE version='2026-09-07.resume-ledger'")
    if(!resumeLedger){
      // Only the most recent legacy timestamp is known; never invent dates for
      // lifetime counts. All subsequent admissions are recorded individually.
      await tx.query('INSERT INTO tp_job_resumes(job_id,resume_number,owner_id,created_at) SELECT id,resume_count,owner_id,resumed_at FROM tp_jobs WHERE resumed_at>0 AND resume_count>0 ON CONFLICT DO NOTHING')
      await tx.query("INSERT INTO tp_schema_migrations(version,applied_at) VALUES('2026-09-07.resume-ledger',$1)",[Date.now()])
    }
    await tx.query("ALTER TABLE tp_jobs ADD COLUMN IF NOT EXISTS activities jsonb NOT NULL DEFAULT '[]'")
    await tx.query(`CREATE TABLE IF NOT EXISTS tp_events (
      resource_id text NOT NULL REFERENCES tp_resources(id), sequence integer NOT NULL,
      kind text NOT NULL, payload jsonb NOT NULL, created_at bigint NOT NULL,
      PRIMARY KEY(resource_id,sequence))`)
    await tx.query('CREATE INDEX IF NOT EXISTS tp_events_retention ON tp_events(created_at)')
    await tx.query('CREATE TABLE IF NOT EXISTS tp_http_limits (key text PRIMARY KEY,hits bigint NOT NULL,expires_at bigint NOT NULL)')
    await tx.query('CREATE INDEX IF NOT EXISTS tp_http_limits_expiry ON tp_http_limits(expires_at)')
    await tx.query(`CREATE TABLE IF NOT EXISTS tp_sessions (
      token_hash text PRIMARY KEY, owner_id text NOT NULL, expires_at bigint NOT NULL)`)
    await tx.query('CREATE INDEX IF NOT EXISTS tp_sessions_expiry ON tp_sessions(expires_at)')
    await tx.query(`CREATE TABLE IF NOT EXISTS tp_material_uploads (resource_id text PRIMARY KEY REFERENCES tp_resources(id),base64 text NOT NULL)`)
    await tx.query(`CREATE TABLE IF NOT EXISTS tp_oauth_attempts (state_hash text PRIMARY KEY,binding_hash text NOT NULL,expires_at bigint NOT NULL)`)
    await tx.query('CREATE INDEX IF NOT EXISTS tp_oauth_attempts_expiry ON tp_oauth_attempts(expires_at)')
    await tx.query(`CREATE TABLE IF NOT EXISTS tp_zhihu_accounts (owner_id text PRIMARY KEY,token_cipher text NOT NULL,token_expires_at bigint NOT NULL,profile jsonb NOT NULL)`)
    await tx.query(`CREATE TABLE IF NOT EXISTS tp_memories (
      owner_id text NOT NULL, source_hash text NOT NULL, summary text NOT NULL,
      created_at bigint NOT NULL, PRIMARY KEY(owner_id,source_hash))`)
    await tx.query(`CREATE TABLE IF NOT EXISTS tp_provider_cooldowns (pool text PRIMARY KEY, until_at bigint NOT NULL)` )
    await tx.query(`CREATE TABLE IF NOT EXISTS tp_provider_starts (pool text PRIMARY KEY, next_at bigint NOT NULL)`)
    await tx.query(`CREATE TABLE IF NOT EXISTS tp_provider_cache (
      owner_id text NOT NULL, cache_key text NOT NULL, body jsonb NOT NULL, expires_at bigint NOT NULL,
      PRIMARY KEY(owner_id,cache_key))`)
    await tx.query(`CREATE INDEX IF NOT EXISTS tp_provider_cache_expiry ON tp_provider_cache(expires_at)`)
    await tx.query(`CREATE TABLE IF NOT EXISTS tp_provider_calls (
      id text PRIMARY KEY, owner_id text NOT NULL, job_id text NOT NULL, step text NOT NULL,
      provider text NOT NULL, body jsonb NOT NULL, created_at bigint NOT NULL)`)
    await tx.query(`CREATE INDEX IF NOT EXISTS tp_provider_calls_owner ON tp_provider_calls(owner_id,created_at)`)
    await tx.query(`CREATE INDEX IF NOT EXISTS tp_library_page ON tp_resources(owner_id,updated_at DESC,id DESC) WHERE kind IN ('path','chat','learning')`)
    await tx.query(`CREATE INDEX IF NOT EXISTS tp_provider_calls_created ON tp_provider_calls(created_at)`)
    await tx.query(`CREATE TABLE IF NOT EXISTS tp_provider_slots (
      pool text NOT NULL, slot integer NOT NULL, token text, lease_until bigint NOT NULL,
      PRIMARY KEY(pool,slot))`)
    await tx.query(`CREATE TABLE IF NOT EXISTS tp_author_network (
      owner_id text NOT NULL, author_id text NOT NULL, evidence_id text NOT NULL,
      weight text NOT NULL CHECK(weight IN ('high','low')), body jsonb NOT NULL,
      PRIMARY KEY(owner_id,author_id,evidence_id,weight))`)
    await tx.query(`CREATE TABLE IF NOT EXISTS tp_author_discoveries (
      owner_id text NOT NULL,author_id text NOT NULL,evidence_id text NOT NULL,topic_id text NOT NULL,body jsonb NOT NULL,
      PRIMARY KEY(owner_id,author_id,evidence_id,topic_id))`)
    const [relations]=await tx.query("SELECT version FROM tp_schema_migrations WHERE version='2026-09-06.author-relations-v4'")
    if(!relations){
      await tx.query("ALTER TABLE tp_author_discoveries ADD COLUMN IF NOT EXISTS search_id text NOT NULL DEFAULT 'legacy'")
      await tx.query('ALTER TABLE tp_author_discoveries DROP CONSTRAINT IF EXISTS tp_author_discoveries_pkey')
      await tx.query('ALTER TABLE tp_author_discoveries ADD PRIMARY KEY(owner_id,author_id,evidence_id,topic_id,search_id)')
      await tx.query("INSERT INTO tp_schema_migrations(version,applied_at) VALUES('2026-09-06.author-relations-v4',$1)",[Date.now()])
    }
    await tx.query(`CREATE TABLE IF NOT EXISTS tp_author_usage (
      owner_id text NOT NULL,event_key text NOT NULL,author_id text NOT NULL,topic_id text NOT NULL,
      amount double precision NOT NULL CHECK(amount>0 AND amount<=1),body jsonb NOT NULL,created_at bigint NOT NULL,
      PRIMARY KEY(owner_id,event_key,author_id))`)
    await tx.query(`CREATE TABLE IF NOT EXISTS tp_author_preferences (
      owner_id text NOT NULL,author_id text NOT NULL,topic_id text NOT NULL,evidence_id text NOT NULL DEFAULT '',
      kind text NOT NULL CHECK(kind IN ('helpful','pinned','hidden')),value boolean NOT NULL,updated_at bigint NOT NULL,
      PRIMARY KEY(owner_id,author_id,topic_id,evidence_id,kind))`)
    await tx.query(`CREATE TABLE IF NOT EXISTS tp_author_commands (
      owner_id text NOT NULL,command_key text NOT NULL,input_hash text NOT NULL,PRIMARY KEY(owner_id,command_key))`)
    await tx.query("INSERT INTO tp_schema_migrations(version,applied_at) VALUES('2026-09-06.authors-v3',$1) ON CONFLICT DO NOTHING",[Date.now()])
    await tx.query("INSERT INTO tp_schema_migrations(version,applied_at) VALUES('2026-09-06.1',$1) ON CONFLICT DO NOTHING",[Date.now()])
  })
}
