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
    const client = postgres(options.url, { max: 10, onnotice: () => {}, types: { serializedJson: { to: 3802, from: [114,3802], serialize: (value: unknown) => typeof value==='string'?value:JSON.stringify(value), parse: (value: string) => JSON.parse(value) }, safeInteger: { to: 20, from: [20], serialize: (value: number) => String(value), parse: (value: string) => { const result=Number(value); if(!Number.isSafeInteger(result))throw new Error('DATABASE_INTEGER_RANGE'); return result } } } })
    function wrap(connection: any): Sql {
      return {
        async query<T>(sql: string, params: unknown[] = []) { return [...await connection.unsafe(sql, params)] as T[] },
        transaction: (fn) => connection.begin((tx: any) => fn(wrap(tx))),
        close: () => client.end(),
      }
    }
    return wrap(client)
  }
  if (options.directory) await mkdir(options.directory, { recursive: true, mode: 0o700 })
  const db = new PGlite(options.directory)
  await db.waitReady
  function wrap(connection: Pick<PGlite, 'query'>): Sql {
    return {
      async query<T>(sql: string, params: unknown[] = []) { return (await connection.query<T>(sql, params)).rows },
      transaction: (fn) => db.transaction((tx) => fn(wrap(tx))),
      close: () => db.close(),
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
    await tx.query(`CREATE INDEX IF NOT EXISTS tp_jobs_queue ON tp_jobs(status,next_at,lease_until)`)
    await tx.query(`CREATE TABLE IF NOT EXISTS tp_events (
      resource_id text NOT NULL REFERENCES tp_resources(id), sequence integer NOT NULL,
      kind text NOT NULL, payload jsonb NOT NULL, created_at bigint NOT NULL,
      PRIMARY KEY(resource_id,sequence))`)
    await tx.query(`CREATE TABLE IF NOT EXISTS tp_sessions (
      token_hash text PRIMARY KEY, owner_id text NOT NULL, expires_at bigint NOT NULL)`)
    await tx.query(`CREATE TABLE IF NOT EXISTS tp_material_uploads (resource_id text PRIMARY KEY REFERENCES tp_resources(id),base64 text NOT NULL)`)
    await tx.query(`CREATE TABLE IF NOT EXISTS tp_oauth_attempts (state_hash text PRIMARY KEY,binding_hash text NOT NULL,expires_at bigint NOT NULL)`)
    await tx.query(`CREATE TABLE IF NOT EXISTS tp_zhihu_accounts (owner_id text PRIMARY KEY,token_cipher text NOT NULL,token_expires_at bigint NOT NULL,profile jsonb NOT NULL)`)
    await tx.query(`CREATE TABLE IF NOT EXISTS tp_memories (
      owner_id text NOT NULL, source_hash text NOT NULL, summary text NOT NULL,
      created_at bigint NOT NULL, PRIMARY KEY(owner_id,source_hash))`)
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
