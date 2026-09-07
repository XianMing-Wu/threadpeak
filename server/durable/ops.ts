import {serverEnvironment} from './bootstrap.ts'
import {openDatabase} from './database.ts'
const env=serverEnvironment()
if(!env.DATABASE_URL)throw new Error('DATABASE_URL_REQUIRED')
const db=await openDatabase({url:env.DATABASE_URL})
try {
  const states=await db.query('SELECT status,count(*)::integer AS count FROM tp_jobs GROUP BY status')
  const delays=await db.query("SELECT count(*)::integer AS expired FROM tp_jobs WHERE status='running' AND lease_until<$1",[Date.now()])
  const reasons=await db.query("SELECT error_code,count(*)::integer AS count FROM tp_jobs WHERE status='waiting' GROUP BY error_code")
  process.stdout.write(JSON.stringify({states,delays,reasons})+'\n')
}finally{await db.close()}
