import { AsyncLocalStorage } from 'node:async_hooks'
import type { Sql } from './sql.ts'
import { CommandError } from './command-error.ts'

type Scope = { owner: string; generation: number }
export const workspaceWrites = new AsyncLocalStorage<Scope>()
export const workspaceLock = (owner: string) => `workspace-data:${owner}`
export async function workspaceGeneration(db: Sql, owner: string) {
  const [row] = await db.query<{generation: number}>('SELECT generation FROM tp_workspace_resets WHERE owner_id=$1', [owner])
  return row?.generation ?? 0
}

/** Hold a shared lock only during writes, never while waiting on a model/network.
 * Reset takes the exclusive lock; old HTTP/worker contexts cannot write afterwards.
 */
export function fenceDatabase(db: Sql, held?: Scope): Sql {
  const guard = async (tx: Sql, scope: Scope) => {
    await tx.query('SELECT pg_advisory_xact_lock_shared(hashtext($1))', [workspaceLock(scope.owner)])
    if (await workspaceGeneration(tx, scope.owner) !== scope.generation) throw new CommandError('WORKSPACE_CLEARED')
  }
  return {
    query: async (sql, params) => {
      const scope = workspaceWrites.getStore()
      if (!scope || held === scope || /^\s*(SELECT|SHOW|EXPLAIN)\b/i.test(sql) || /^\s*(UPDATE|INSERT INTO|DELETE FROM)\s+(tp_provider_(slots|starts|cooldowns)|tp_http_limits)\b/i.test(sql)) return db.query(sql, params)
      return db.transaction(async tx => { await guard(tx, scope); return tx.query(sql, params) })
    },
    transaction: fn => {
      const scope = workspaceWrites.getStore()
      return db.transaction(async tx => {
        if (scope && held !== scope) await guard(tx, scope)
        return fn(fenceDatabase(tx, scope))
      })
    },
    close: () => db.close(),
  }
}
