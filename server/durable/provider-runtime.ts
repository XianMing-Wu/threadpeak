import { createHash,randomUUID } from 'node:crypto'
import type { LlmProvider,ProviderMetadata,ZhihuProvider } from '../agent-runtime/types.ts'
import type { ProviderConfig } from '../config.ts'
import type { Sql } from './database.ts'
import {classifyTaskError} from './worker.ts'
import { providerScope } from './provider-scope.ts'

export const cacheUserId=(owner:string)=>'tp_'+createHash('sha256').update('threadpeak:owner:'+owner).digest('hex')

async function recordCall(db:Sql,provider:string,model:string,start:number,result:ProviderMetadata&{kind:string;code?:string}) {
  const scope=providerScope.getStore();if(!scope)return
  const body={model,result:result.kind,code:result.code,cache:result.cache,durationMs:Date.now()-start,queueMs:scope.queueMs,usage:result.usage,diagnostic:result.diagnostic}
  try{
    await db.query('INSERT INTO tp_provider_calls(id,owner_id,job_id,step,provider,body,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),scope.ownerId,scope.jobId,scope.step,provider,JSON.stringify(body),Date.now()])
  }catch{process.stderr.write(JSON.stringify({event:'provider.telemetry_unavailable',provider})+'\n')}
}
export function instrumentProviders(db:Sql,config:ProviderConfig,llm:LlmProvider,zhihu:ZhihuProvider) {
  const measure=async<T extends ProviderMetadata&{kind:string;code?:string}>(provider:string,model:string,work:()=>Promise<T>):Promise<T>=>{
    const parent=providerScope.getStore()
    const run=async()=>{const start=Date.now();try{const result=await work();await recordCall(db,provider,model,start,result);return result}catch(error){await recordCall(db,provider,model,start,{kind:'failed',code:classifyTaskError(error).code});throw error}}
    return parent?providerScope.run({...parent,queueMs:0},run):run()
  }
  const search=(q:string,count:number,signal?:AbortSignal,web=false)=>measure(web?'zhihu.globalSearch':'zhihu.search','search',()=>(web?zhihu.globalSearch!:zhihu.search)(q,count,signal))
  return {
    llm:{complete:input=>measure('deepseek',config.deepseekModelName,()=>{
      const owner=providerScope.getStore()?.ownerId
      return llm.complete({...input,...(owner?{cacheUserId:cacheUserId(owner)}:{})})
    })} as LlmProvider,
    zhihu:{search:(q,count,signal)=>search(q,count,signal),...(zhihu.globalSearch?{globalSearch:(q:string,count:number,signal?:AbortSignal)=>search(q,count,signal,true)}:{})} as ZhihuProvider,
  }
}
