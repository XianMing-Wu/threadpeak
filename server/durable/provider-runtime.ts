import { createHash,randomUUID } from 'node:crypto'
import type { LlmProvider,ProviderMetadata,ZhihuProvider } from '../agent-runtime/types.ts'
import type { ProviderConfig } from '../config.ts'
import { AGENT_CONTRACT_VERSION } from '../agent-runtime/goal-policy.ts'
import { zhidaModelFor } from '../agent-runtime/constants.ts'
import { digest } from './store.ts'
import type { Sql } from './database.ts'
import { withPermit } from './limits.ts'
import {classifyTaskError} from './worker.ts'
import { providerScope } from './provider-scope.ts'

export const DIRECT_CACHE_TTL_MS = 24*60*60*1000
export const cacheUserId=(owner:string)=>'tp_'+createHash('sha256').update('threadpeak:owner:'+owner).digest('hex')

/** Exact successful response reuse, separate from a model's KV prefix cache. */
export function cacheZhihuDirect(provider:ZhihuProvider,db:Sql,namespace:string,ttlMs=DIRECT_CACHE_TTL_MS):ZhihuProvider {
  return {...provider,direct:async input=>{
    const owner=providerScope.getStore()?.ownerId
    if(!owner)return provider.direct(input)
    input.signal?.throwIfAborted()
    const key=digest({version:`direct-v1:${AGENT_CONTRACT_VERSION}`,namespace,owner,model:zhidaModelFor(input.thinkingDepth),messages:input.messages,depth:input.thinkingDepth})
    const read=async()=>{
      input.signal?.throwIfAborted()
      const [row]=await db.query<{body:{text:string}}>('SELECT body FROM tp_provider_cache WHERE owner_id=$1 AND cache_key=$2 AND expires_at>$3',[owner,key,Date.now()])
      input.signal?.throwIfAborted()
      return row?.body.text?{kind:'completed' as const,text:row.body.text,cache:'hit' as const}:undefined
    }
    const cached=await read();if(cached)return cached
    return withPermit(db,`direct-cache:${key}`,1,input.signal,async signal=>{
      const shared=await read();if(shared)return shared
      const result=await provider.direct({...input,signal})
      signal.throwIfAborted()
      if(result.kind==='completed'&&result.cacheable===true&&result.text.trim()&&result.text.length<=200_000){
        await db.transaction(async tx=>{
          signal.throwIfAborted()
          await tx.query('INSERT INTO tp_provider_cache(owner_id,cache_key,body,expires_at) VALUES($1,$2,$3,$4) ON CONFLICT(owner_id,cache_key) DO UPDATE SET body=EXCLUDED.body,expires_at=EXCLUDED.expires_at',[owner,key,JSON.stringify({text:result.text}),Date.now()+ttlMs])
          signal.throwIfAborted()
        })
      }
      return {...result,cache:'miss' as const}
    },{ephemeral:true})
  }}
}

async function recordCall(db:Sql,provider:string,model:string,start:number,result:ProviderMetadata&{kind:string;code?:string}) {
  const scope=providerScope.getStore();if(!scope)return
  const body={model,result:result.kind,code:result.code,cache:result.cache,durationMs:Date.now()-start,queueMs:scope.queueMs,usage:result.usage,diagnostic:result.diagnostic}
  try{
    await db.query('INSERT INTO tp_provider_calls(id,owner_id,job_id,step,provider,body,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),scope.ownerId,scope.jobId,scope.step,provider,JSON.stringify(body),Date.now()])
  }catch{process.stderr.write(JSON.stringify({event:'provider.telemetry_unavailable',provider})+'\n')}
}
export function instrumentProviders(db:Sql,config:ProviderConfig,llm:LlmProvider,zhihu:ZhihuProvider) {
  const cached=cacheZhihuDirect(zhihu,db,digest({origin:config.zhihuApiBaseUrl,credential:config.zhihuAccessSecret}))
  const measure=async<T extends ProviderMetadata&{kind:string;code?:string}>(provider:string,model:string,work:()=>Promise<T>):Promise<T>=>{
    const parent=providerScope.getStore()
    const run=async()=>{const start=Date.now();try{const result=await work();await recordCall(db,provider,model,start,result);return result}catch(error){await recordCall(db,provider,model,start,{kind:'failed',code:classifyTaskError(error).code});throw error}}
    return parent?providerScope.run({...parent,queueMs:0},run):run()
  }
  const search=(q:string,count:number,signal?:AbortSignal,web=false)=>measure(web?'zhihu.globalSearch':'zhihu.search','search',()=>(web?cached.globalSearch!:cached.search)(q,count,signal))
  return {
    llm:{complete:input=>measure('deepseek',config.deepseekModelName,()=>{
      const owner=providerScope.getStore()?.ownerId
      return llm.complete({...input,...(owner?{cacheUserId:cacheUserId(owner)}:{})})
    })} as LlmProvider,
    zhihu:{search:(q,count,signal)=>search(q,count,signal),...(cached.globalSearch?{globalSearch:(q:string,count:number,signal?:AbortSignal)=>search(q,count,signal,true)}:{}),direct:input=>measure('zhihu.direct',zhidaModelFor(input.thinkingDepth),()=>cached.direct(input))} as ZhihuProvider,
  }
}
