import {readStageMetrics} from './ops-metrics.ts'
import {serverEnvironment} from './bootstrap.ts'
import {openDatabase} from './database.ts'
const env=serverEnvironment()
if(!env.DATABASE_URL)throw new Error('DATABASE_URL_REQUIRED')
const db=await openDatabase({url:env.DATABASE_URL})
try {
  const states=await db.query('SELECT status,count(*)::integer AS count FROM tp_jobs GROUP BY status')
  const delays=await db.query("SELECT count(*)::integer AS expired FROM tp_jobs WHERE status='running' AND lease_until<$1",[Date.now()])
  const reasons=await db.query("SELECT error_code,count(*)::integer AS count FROM tp_jobs WHERE status='waiting' GROUP BY error_code")
  const exhausted=await db.query("SELECT id,owner_id,kind,error_code,resume_count FROM tp_jobs WHERE status='waiting' AND resume_count>=4 ORDER BY updated_at DESC LIMIT 100")
  const since=Date.now()-86400_000,stages=await readStageMetrics(db,since)
  process.stdout.write(JSON.stringify({states,delays,reasons,exhausted,metrics:{since,until:Date.now(),nestedSpans:true,stages}})+'\n')
}finally{await db.close()}
