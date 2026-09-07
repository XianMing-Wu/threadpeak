import type { Sql } from './database.ts'
import { withPermit } from './limits.ts'
import type { ZhihuProvider } from '../agent-runtime/types.ts'
import { providerScope } from './provider-scope.ts'

export const ZHIHU_START_INTERVAL_MS = 2100

/** One shared budget for all Zhihu APIs, including bodies still being read. */
export type ZhihuGate = {
  run<T>(signal:AbortSignal|undefined, work:(signal:AbortSignal)=>Promise<T>):Promise<T>
  observe(response:{status:number;headers?:{get(name:string):string|null}}):Promise<void>
}

export function retryAfterUntil(value:string|null|undefined, now=Date.now()) {
  if(value?.trim()) {
    const delay=/^\d+(?:\.\d+)?$/.test(value.trim())?Number(value)*1000:Date.parse(value)-now
    if(Number.isFinite(delay)&&delay>0)return now+delay
  }
  return now+10_000
}

export function createZhihuGate(db:Sql,intervalMs=ZHIHU_START_INTERVAL_MS):ZhihuGate {
  return {
    run:(signal,work)=>withPermit(db,'zhihu',2,signal,work,{intervalMs,onQueue:providerScope.getStore()?.queue}),
    async observe(response){
      if(response.status!==429)return
      const until=retryAfterUntil(response.headers?.get('retry-after'))
      await db.query('INSERT INTO tp_provider_cooldowns(pool,until_at) VALUES($1,$2) ON CONFLICT(pool) DO UPDATE SET until_at=GREATEST(tp_provider_cooldowns.until_at,EXCLUDED.until_at)',['zhihu',until])
    },
  }
}

export function limitZhihuProvider(provider:ZhihuProvider,gate:ZhihuGate):ZhihuProvider {
  const search=async(q:string,count:number,signal:AbortSignal|undefined,web=false)=>gate.run(signal,async next=>{
    const result=await (web?provider.globalSearch!:provider.search)(q,count,next)
    if(result.kind==='failed'&&result.code==='ZHIHU_RATE_LIMITED'&&result.diagnostic?.httpStatus===200)await gate.observe({status:429})
    return result
  })
  return {
    search:(q,count,signal)=>search(q,count,signal),
    ...(provider.globalSearch?{globalSearch:(q:string,count:number,signal?:AbortSignal)=>search(q,count,signal,true)}:{}),
    direct:input=>gate.run(input.signal,signal=>provider.direct({...input,signal})),
  }
}
