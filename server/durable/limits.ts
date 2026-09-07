import { randomUUID } from 'node:crypto'
import type { Sql } from './database.ts'
import { ToolError } from './worker.ts'

export function pause(ms:number,signal?:AbortSignal){return new Promise<void>((resolve,reject)=>{
  if(signal?.aborted){reject(signal.reason);return}
  const done=()=>{signal?.removeEventListener('abort',abort);resolve()},timer=setTimeout(done,ms)
  const abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(signal?.reason)}
  signal?.addEventListener('abort',abort,{once:true})
})}
/** Shared across API replicas; expired permits are reclaimed after worker death. */
export async function withPermit<T>(db:Sql,pool:string,limit:number,signal:AbortSignal|undefined,work:(signal:AbortSignal)=>Promise<T>):Promise<T>{
  const token=randomUUID(),controller=new AbortController(),combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal
  const started=Date.now();let slot:number|undefined
  while(slot===undefined){
    combined.throwIfAborted()
    slot=await db.transaction(async tx=>{
      for(let i=0;i<limit;i++)await tx.query('INSERT INTO tp_provider_slots(pool,slot,lease_until) VALUES($1,$2,0) ON CONFLICT DO NOTHING',[pool,i])
      const [row]=await tx.query<{slot:number}>('SELECT slot FROM tp_provider_slots WHERE pool=$1 AND slot<$2 AND lease_until<$3 ORDER BY slot FOR UPDATE SKIP LOCKED LIMIT 1',[pool,limit,Date.now()])
      if(!row)return
      await tx.query('UPDATE tp_provider_slots SET token=$3,lease_until=$4 WHERE pool=$1 AND slot=$2',[pool,row.slot,token,Date.now()+60_000]);return row.slot
    })
    if(slot===undefined){if(Date.now()-started>180_000)throw new ToolError('PROVIDER_QUEUE_TIMEOUT');await pause(180,combined)}
  }
  const heartbeat=setInterval(()=>{void db.query('UPDATE tp_provider_slots SET lease_until=$4 WHERE pool=$1 AND slot=$2 AND token=$3 RETURNING slot',[pool,slot,token,Date.now()+60_000]).then(rows=>{if(!rows.length)controller.abort()}).catch(()=>controller.abort())},15_000)
  try{return await work(combined)}finally{clearInterval(heartbeat);await db.query('UPDATE tp_provider_slots SET lease_until=0,token=NULL WHERE pool=$1 AND slot=$2 AND token=$3',[pool,slot,token])}
}
