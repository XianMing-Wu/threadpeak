import { randomUUID } from 'node:crypto'
import { AsyncLocalStorage } from 'node:async_hooks'
import type { Sql } from './database.ts'
import { ToolError } from './worker.ts'

export function pause(ms:number,signal?:AbortSignal){return new Promise<void>((resolve,reject)=>{
  if(signal?.aborted){reject(signal.reason);return}
  const done=()=>{signal?.removeEventListener('abort',abort);resolve()},timer=setTimeout(done,ms)
  const abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(signal?.reason)}
  signal?.addEventListener('abort',abort,{once:true})
})}
const heldPools = new AsyncLocalStorage<string[]>()
type PermitOptions = {intervalMs?:number;onQueue?:(detail?:string)=>Promise<void>;ephemeral?:boolean;now?:()=>number;wait?:typeof pause;leaseMs?:number;heartbeatMs?:number}
/** PostgreSQL shares permits across replicas; a PGlite database has one process owner. */
export async function withPermit<T>(db:Sql,pool:string,limit:number,signal:AbortSignal|undefined,work:(signal:AbortSignal)=>Promise<T>,options:PermitOptions={}):Promise<T>{
  const held=heldPools.getStore()??[]
  // Cache coalescing precedes provider admission. An inverted or recursive
  // acquisition fails immediately instead of occupying both scarce permits.
  if(held.includes(pool)||(pool.startsWith('direct-cache:')&&held.length))throw new ToolError('PERMIT_ORDER_INVALID',false)
  const token=randomUUID(),controller=new AbortController(),combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal
  const now=options.now??Date.now,wait=options.wait??pause,leaseMs=options.leaseMs??30_000
  const started=now();let slot:number|undefined,queued=false,delay=180
  combined.throwIfAborted()
  await db.query('INSERT INTO tp_provider_slots(pool,slot,lease_until) SELECT $1,generate_series(0,$2::integer-1),0 ON CONFLICT DO NOTHING',[pool,limit])
  if(options.intervalMs)await db.query('INSERT INTO tp_provider_starts(pool,next_at) VALUES($1,0) ON CONFLICT DO NOTHING',[pool])
  while(slot===undefined){
    combined.throwIfAborted()
    let waitUntil=0
    slot=await db.transaction(async tx=>{
      if(options.intervalMs){
        const [start]=await tx.query<{next_at:number}>('SELECT next_at FROM tp_provider_starts WHERE pool=$1 FOR UPDATE',[pool])
        if(Number(start!.next_at)>now()){waitUntil=Number(start!.next_at);return}
      }
      const [cooldown]=await tx.query<{until_at:number}>('SELECT until_at FROM tp_provider_cooldowns WHERE pool=$1',[pool])
      if(cooldown&&Number(cooldown.until_at)>now()){waitUntil=Number(cooldown.until_at);return}
      const [row]=await tx.query<{slot:number}>('SELECT slot FROM tp_provider_slots WHERE pool=$1 AND slot<$2 AND lease_until<$3 ORDER BY slot FOR UPDATE SKIP LOCKED LIMIT 1',[pool,limit,now()])
      if(!row){
        if(options.ephemeral)await tx.query('INSERT INTO tp_provider_slots(pool,slot,lease_until) VALUES($1,0,0) ON CONFLICT DO NOTHING',[pool])
        return
      }
      await tx.query('UPDATE tp_provider_slots SET token=$3,lease_until=$4 WHERE pool=$1 AND slot=$2',[pool,row.slot,token,now()+leaseMs])
      if(options.intervalMs)await tx.query('UPDATE tp_provider_starts SET next_at=$2 WHERE pool=$1',[pool,now()+options.intervalMs])
      return row.slot
    })
    if(slot===undefined){
      if(!queued){queued=true;await options.onQueue?.('正在排队，等待知乎请求间隔或可用名额')}
      if(now()-started>180_000)throw new ToolError('PROVIDER_QUEUE_TIMEOUT',false)
      await wait(waitUntil?Math.max(1,Math.min(5000,waitUntil-now())):delay,combined)
      delay=Math.min(2000,delay*1.5)
    }
  }
  const heartbeat=setInterval(()=>{void db.query('UPDATE tp_provider_slots SET lease_until=$4 WHERE pool=$1 AND slot=$2 AND token=$3 RETURNING slot',[pool,slot,token,now()+leaseMs]).then(rows=>{if(!rows.length)controller.abort()}).catch(()=>controller.abort())},options.heartbeatMs??5000)
  try{combined.throwIfAborted();if(queued)await options.onQueue?.();return await heldPools.run([...held,pool],()=>work(combined))}finally{
    clearInterval(heartbeat)
    await db.query('UPDATE tp_provider_slots SET lease_until=$4,token=NULL WHERE pool=$1 AND slot=$2 AND token=$3',[pool,slot,token,options.ephemeral?now():0])
    // Deleting an ephemeral pool here can race a seeded waiter. Keep its row;
    // maintenance removes idle cache pools only when there are no cache calls.
  }
}
