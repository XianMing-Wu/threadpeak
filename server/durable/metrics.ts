import {randomUUID} from 'node:crypto'
import type {Sql} from './database.ts'
import {providerScope} from './provider-scope.ts'
type Metric={kind:'context'|'summary'|'step'|'task'|'commit';durationMs:number;[key:string]:string|number|undefined}
/** Numeric counters and server-owned or hashed identities only; no source/prompt text. */
export async function recordMetric(db:Sql,scope:{owner_id:string;id:string},step:string,metric:Metric){
  try{await db.query('INSERT INTO tp_provider_calls(id,owner_id,job_id,step,provider,body,created_at) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)',[randomUUID(),scope.owner_id,scope.id,step,['context','summary'].includes(metric.kind)?'context':'workflow',JSON.stringify({result:'completed',...metric}),Date.now()])}
  catch{process.stderr.write(JSON.stringify({event:'workflow.telemetry_unavailable'})+'\n')}
}
export const recordContextMetric=(ctx:{store:{db:Sql};job:{owner_id:string;id:string}},metric:Metric)=>recordMetric(ctx.store.db,ctx.job,providerScope.getStore()?.step??'context',metric)
