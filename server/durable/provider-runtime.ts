import { createHash,randomUUID } from 'node:crypto'
import type { LlmProvider,ProviderMetadata,ZhihuProvider } from '../agent-runtime/types.ts'
import type { ProviderConfig } from '../config.ts'
import { AGENT_CONTRACT_VERSION } from '../agent-runtime/goal-policy.ts'
import { zhidaModelFor } from '../agent-runtime/constants.ts'
import { digest } from './store.ts'
import type { Sql } from './database.ts'
import { withPermit } from './limits.ts'
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
          await tx.query('DELETE FROM tp_provider_cache WHERE expires_at<=$1',[Date.now()])
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
  const body={model,result:result.kind,code:result.code,cache:result.cache,durationMs:Date.now()-start,usage:result.usage,diagnostic:result.diagnostic}
  try{
    await db.query('INSERT INTO tp_provider_calls(id,owner_id,job_id,step,provider,body,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),scope.ownerId,scope.jobId,scope.step,provider,JSON.stringify(body),Date.now()])
    await db.query('DELETE FROM tp_provider_calls WHERE created_at<$1',[Date.now()-7*24*60*60*1000])
  }catch{process.stderr.write(JSON.stringify({event:'provider.telemetry_unavailable',provider})+'\n')}
}
export function instrumentProviders(db:Sql,config:ProviderConfig,llm:LlmProvider,zhihu:ZhihuProvider) {
  const cached=cacheZhihuDirect(zhihu,db,digest({origin:config.zhihuApiBaseUrl,credential:config.zhihuAccessSecret}))
  const search=async(q:string,count:number,signal?:AbortSignal,web=false)=>{
    const start=Date.now(),result=await (web?cached.globalSearch!:cached.search)(q,count,signal)
    await recordCall(db,web?'zhihu.globalSearch':'zhihu.search','search',start,result);return result
  }
  return {
    llm:{complete:async input=>{
      const owner=providerScope.getStore()?.ownerId,start=Date.now()
      const result=await llm.complete({...input,...(owner?{cacheUserId:cacheUserId(owner)}:{})})
      await recordCall(db,'deepseek',config.deepseekModelName,start,result);return result
    }} as LlmProvider,
    zhihu:{search:(q,count,signal)=>search(q,count,signal),...(cached.globalSearch?{globalSearch:(q:string,count:number,signal?:AbortSignal)=>search(q,count,signal,true)}:{}),direct:async input=>{
      const start=Date.now(),result=await cached.direct(input)
      await recordCall(db,'zhihu.direct',zhidaModelFor(input.thinkingDepth),start,result);return result
    }} as ZhihuProvider,
  }
}
