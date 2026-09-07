import type { ProviderDiagnostic, ProviderUsage } from './types.ts'

export function readUsage(value:unknown):ProviderUsage|undefined {
  if(!value||typeof value!=='object')return
  const fields=['prompt_tokens','completion_tokens','total_tokens','prompt_cache_hit_tokens','prompt_cache_miss_tokens'] as const
  const entries=fields.flatMap(key=>{
    const n=(value as Record<string,unknown>)[key]
    return typeof n==='number'&&Number.isSafeInteger(n)&&n>=0?[[key,n]]:[]
  })
  return entries.length?Object.fromEntries(entries):undefined
}
export function providerDiagnostic(status:number,payload:unknown,headers?:{get(name:string):string|null}):ProviderDiagnostic {
  const p=payload as any,raw=p?.error?.code??p?.Code??p?.code
  const safe=(v:unknown,max:number)=>typeof v==='string'&&v.length<=max&&/^[\w.:-]+$/.test(v)?v:undefined
  return {httpStatus:status,upstreamCode:safe(String(raw??''),80),requestId:safe(headers?.get('x-request-id')??headers?.get('request-id')??p?.id,128)}
}
export function parseProviderError(text:string):unknown {
  try{return text.length<=50_000?JSON.parse(text):undefined}catch{return undefined}
}
export function classifyProviderError(status:number,upstreamCode?:string,zhihu=false) {
  if(/^(?:insufficient_quota|quota_exceeded|daily_quota_exceeded|balance_not_enough)$/i.test(upstreamCode??'')||status===402)return {code:zhihu?'ZHIHU_QUOTA_EXCEEDED':'MODEL_QUOTA_EXCEEDED',retryable:false}
  if(status===429||upstreamCode==='30001'||upstreamCode==='rate_limit_exceeded')return {code:zhihu?'ZHIHU_RATE_LIMITED':'RATE_LIMITED',retryable:true}
  if(status===401||status===403||upstreamCode==='20001')return {code:'AUTH_INVALID',retryable:false}
  if(zhihu&&status===200&&/^\d+$/.test(upstreamCode??''))return {code:`ZHIHU_CODE_${upstreamCode}`,retryable:['40003','90001'].includes(upstreamCode!)}
  return {code:`${zhihu?'ZHIHU_':''}HTTP_${status}`,retryable:status===408||status>=500}
}
