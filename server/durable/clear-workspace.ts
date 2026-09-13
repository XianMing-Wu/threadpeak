import { workspaceGeneration, workspaceLock, workspaceWrites } from './workspace-fence.ts'
import {CommandError} from './command-error.ts'
import type { DurableStore } from './store.ts'

/** Clear learning data only. Identity and OAuth authorization are not learning data. */
export async function clearWorkspace(store: DurableStore, owner: string, key: string, expectedGeneration?: number) {
  const result = await workspaceWrites.exit(() => store.db.transaction(async tx => {
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [workspaceLock(owner)])
    const [receipt] = await tx.query('SELECT command_key FROM tp_workspace_reset_commands WHERE owner_id=$1 AND command_key=$2', [owner, key])
    if (receipt) return { jobs: [] as string[], resources: [] as string[] }
    if(expectedGeneration!==undefined&&expectedGeneration!==await workspaceGeneration(tx,owner))throw new CommandError('WORKSPACE_CLEARED')
    const resources = await tx.query<{id: string}>('SELECT id FROM tp_resources WHERE owner_id=$1 ORDER BY id FOR UPDATE', [owner])
    const jobs = await tx.query<{id: string}>('SELECT id FROM tp_jobs WHERE owner_id=$1', [owner])
    await tx.query('DELETE FROM tp_material_uploads WHERE resource_id IN (SELECT id FROM tp_resources WHERE owner_id=$1)', [owner])
    await tx.query('DELETE FROM tp_events WHERE resource_id IN (SELECT id FROM tp_resources WHERE owner_id=$1)', [owner])
    for (const table of ['tp_job_resumes','tp_path_answer_commands','tp_jobs','tp_author_network','tp_author_discoveries','tp_author_usage','tp_author_preferences','tp_author_commands','tp_memories','tp_provider_cache','tp_provider_calls','tp_resources']) {
      await tx.query(`DELETE FROM ${table} WHERE owner_id=$1`, [owner])
    }
    await tx.query('INSERT INTO tp_workspace_resets(owner_id,generation) VALUES($1,1) ON CONFLICT(owner_id) DO UPDATE SET generation=tp_workspace_resets.generation+1', [owner])
    // Keep content-free receipts so a timed-out clear cannot erase newly created data on replay.
    await tx.query('INSERT INTO tp_workspace_reset_commands(owner_id,command_key) VALUES($1,$2)', [owner, key])
    return { jobs: jobs.map(j => j.id), resources: resources.map(r => r.id) }
  }))
  store.notifyCleared(owner, result.resources, result.jobs)
  return { cleared: true as const }
}
