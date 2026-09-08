import { createHash } from 'node:crypto'
import type { ChatMessage, LlmProvider, ThinkingDepth } from '../agent-runtime/types.ts'
import { semanticChunks, SUMMARY_POLICY } from '../agent-runtime/semantic-chunks.ts'
import { AGENT_CONTRACT_VERSION, summaryPurpose } from '../agent-runtime/goal-policy.ts'
import { ToolError, type TaskContext } from './worker.ts'
import type {ProviderBudget} from './capabilities.ts'
import {recordContextMetric} from './metrics.ts'

// A conservative byte upper bound, not a tokenizer or a claim about billing.
export const tokenBound = (s: string) => Buffer.byteLength(s, 'utf8')
export type ContextPolicy = { window: number; output: number; margin: number;summary?:ProviderBudget }
export const effectiveWindow = (configured: number) => Math.min(500_000, configured)
const contentKeys = new Set(['content','summary','text','description','detailedDescription'])
const protectedKeys = new Set(['goalContext','goal','rawGoal','questionSets','concept','currentQuestion','currentMessage','followUpMessage','question','background','attempted','desiredOutcome','goalHypothesis','learningGoal','goalAlignment','selectedOptions','answerSections','citationCatalog'])
type Field = { object: Record<string, any>; key: string; path: string; length: number }
export function contextJson(value:unknown){
  if(!value||typeof value!=='object'||Array.isArray(value))return JSON.stringify(value)
  // Put long evidence first and the immutable task last. Do not bury user intent
  // before dozens of articles, and do not duplicate it to gain recency.
  const priority=(key:string)=>['currentQuestion','currentMessage','followUpMessage'].includes(key)?5:key==='conversation'?4:key==='goalContext'?3:protectedKeys.has(key)?2:0
  const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(key=>[key,canonical(v[key])])):v
  return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a],[b])=>priority(a)-priority(b)||a.localeCompare(b,'en')).map(([key,v])=>[key,canonical(v)])))
}
function fields(value: unknown, path = '', result: Field[] = []): Field[] {
  if (!value || typeof value !== 'object') return result
  // User statements are first-class constraints; only earlier assistant prose can be shortened.
  if((value as any).role==='user')return result
  for (const [key, item] of Object.entries(value)) {
    if(protectedKeys.has(key))continue
    const p = `${path}/${key}`
    if (typeof item === 'string' && contentKeys.has(key) && tokenBound(item)>1024) result.push({ object: value as Record<string, any>, key, path:p, length:tokenBound(item) })
    else if (item && typeof item === 'object') fields(item, p, result)
  }
  return result
}
export async function boundedSummary(llm:LlmProvider,ctx:TaskContext,text:string,source:string,target:number,depth:ThinkingDepth,configuredWindow:number,purpose:unknown={task:'保留整份资料的知识范围、关系和条件，尚未指定学习目标'},capability?:ProviderBudget):Promise<string>{
  const budget=Math.max(512,Math.floor(target)),window=effectiveWindow(configuredWindow)
  const key=createHash('sha256').update(JSON.stringify({version:AGENT_CONTRACT_VERSION,policy:SUMMARY_POLICY,capability,source,text,budget,depth,window,purpose})).digest('hex')
  return ctx.step(`memory:${key}`,{source,budget,key},async()=>{
    const [memory]=await ctx.store.db.query<{summary:string}>('SELECT summary FROM tp_memories WHERE owner_id=$1 AND source_hash=$2',[ctx.job.owner_id,key])
    const started=Date.now()
    if(memory&&tokenBound(memory.summary)<=budget){await recordContextMetric(ctx,{kind:'summary',cache:'hit',inputBytes:tokenBound(text),outputBytes:tokenBound(memory.summary),durationMs:Date.now()-started,window,budget,namespace:capability?.namespace});return memory.summary}
    const overhead=tokenBound(SUMMARY_POLICY)+tokenBound(JSON.stringify({source,purpose}))+2048
    const reasoning=depth==='deep'?Math.min(8192,Math.floor((capability?.output??16384)/2)):0
    const output=Math.min(capability?.output??16384,16384,Math.max(1024,Math.min(budget,8192))+reasoning,Math.floor((window-overhead)*.4))
    const chunkBudget=Math.min(48000,Math.floor((window-overhead-output)/2))
    if(chunkBudget<512||output<reasoning+512)throw new ToolError('CONTEXT_REQUIRES_PARTITION',false)
    await ctx.activity(`context:summary:${key}`,'read','整理长资料','running','按原始来源保留与目标有关的内容')
    let candidate=text,modelCalls=0,chunkCount=0
    for(let pass=0;pass<8;pass++){
      const parts=semanticChunks(candidate,chunkBudget,tokenBound),summaries:string[]=[]
      const perPart=Math.max(128,Math.floor(budget/Math.max(1,parts.length)))
      chunkCount+=parts.length
      const summarizePart=async(index:number)=>{
        const input={source,pass,part:index+1,parts:parts.length,maximumCharacters:Math.max(24,Math.floor(perPart/(pass>3?6:4))),text:parts[index]!,purpose}
        const messages:ChatMessage[]=[{role:'system',content:SUMMARY_POLICY},{role:'user',content:JSON.stringify(input)}]
        if(messages.reduce((n,m)=>n+tokenBound(m.content)+64,0)+output+1024>window)throw new ToolError('CONTEXT_REQUIRES_PARTITION',false)
        const result=await ctx.step(`memory-part:${key}:${pass}:${index}`,input,async()=>{
          modelCalls++
          const response=await llm.complete({messages,json:false,thinkingDepth:depth,maxTokens:output,signal:ctx.signal})
          if(response.kind==='failed')throw new ToolError(response.code??'SUMMARY_UNAVAILABLE',response.retryable??true)
          if(!response.text.trim())throw new ToolError('SUMMARY_EMPTY')
          return response.text.trim()
        })
        return result
      }
      // Independent source chunks run in pairs; array order and every checkpoint survive.
      for(let index=0;index<parts.length;index+=2){
        const pair=await Promise.allSettled(parts.slice(index,index+2).map((_,offset)=>summarizePart(index+offset)))
        const failed=pair.find(r=>r.status==='rejected');if(failed?.status==='rejected')throw failed.reason
        for(const result of pair)if(result.status==='fulfilled')summaries.push(result.value)
      }
      candidate=summaries.join('\n')
      if(tokenBound(candidate)<=budget){
        await ctx.store.db.query('INSERT INTO tp_memories(owner_id,source_hash,summary,created_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[ctx.job.owner_id,key,candidate,Date.now()])
        await ctx.activity(`context:summary:${key}`,'read','整理长资料','done')
        await recordContextMetric(ctx,{kind:'summary',cache:'miss',inputBytes:tokenBound(text),outputBytes:tokenBound(candidate),durationMs:Date.now()-started,window,budget,modelCalls,chunkCount,passes:pass+1,namespace:capability?.namespace})
        return candidate
      }
    }
    throw new ToolError('SUMMARY_NOT_REDUCED',false)
  })
}

export async function packContext(llm:LlmProvider,ctx:TaskContext,system:string,input:unknown,depth:ThinkingDepth,policy:ContextPolicy):Promise<ChatMessage[]>{
  const started=Date.now(),copy=structuredClone(input),window=effectiveWindow(policy.window),inputBytes=tokenBound(contextJson(input))
  const limit=window-policy.output-policy.margin-tokenBound(system)-128
  if(limit<1024)throw new ToolError('MODEL_CAPABILITY_INVALID',false)
  const purpose=summaryPurpose(input),unreduced=new Set<string>()
  for(let i=0;i<256;i++){
    const json=contextJson(copy)
    if(tokenBound(json)<limit){await recordContextMetric(ctx,{kind:'context',inputBytes,outputBytes:tokenBound(json),durationMs:Date.now()-started,window,outputReserve:policy.output,margin:policy.margin,compressions:i,namespace:policy.summary?.namespace});return [{role:'system',content:system},{role:'user',content:json}]}
    const available=fields(copy).filter(f=>!unreduced.has(f.path)).sort((a,b)=>Number(b.path.startsWith('/conversation/'))-Number(a.path.startsWith('/conversation/'))||b.length-a.length)
    const field=available[0]
    if(!field)throw new ToolError('CONTEXT_REQUIRES_PARTITION',false)
    let shortened:string
    try{shortened=await boundedSummary(llm,ctx,field.object[field.key],field.path,Math.max(512,Math.floor(field.length*.4)),depth,policy.summary?.window??window,purpose,policy.summary)}catch(error){
      if(error instanceof ToolError&&error.code==='SUMMARY_NOT_REDUCED'){unreduced.add(field.path);continue}
      throw error
    }
    const next='[上下文摘要]\n'+shortened
    if(tokenBound(next)>=field.length)throw new ToolError('SUMMARY_NOT_REDUCED',false)
    field.object[field.key]=next
  }
  throw new ToolError('CONTEXT_REQUIRES_PARTITION',false)
}

export {summaryPurpose} from '../agent-runtime/goal-policy.ts'
