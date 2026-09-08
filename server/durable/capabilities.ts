import {createHash} from 'node:crypto'
import type {ThinkingDepth} from '../agent-runtime/types.ts'

export type ProviderBudget={window:number;output:number;namespace:string}
export type ToolCapabilities={llm:ProviderBudget;zhihu:Record<ThinkingDepth,ProviderBudget>}
const identity=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
/** Local ceilings are conservative application defaults, not vendor capability claims. */
export function defaultCapabilities(window=64000):ToolCapabilities{
  return {llm:{window,output:16384,namespace:'local-unconfigured-llm'},zhihu:{fast:{window:32000,output:8192,namespace:'local-unconfigured-zhihu-fast'},deep:{window:32000,output:8192,namespace:'local-unconfigured-zhihu-deep'}}}
}
export function resolveCapabilities(env:Record<string,string|undefined>):ToolCapabilities{
  const keys=['DEEPSEEK_CONTEXT_TOKENS','DEEPSEEK_MAX_OUTPUT_TOKENS','ZHIHU_FAST_CONTEXT_TOKENS','ZHIHU_FAST_OUTPUT_TOKENS','ZHIHU_DEEP_CONTEXT_TOKENS','ZHIHU_DEEP_OUTPUT_TOKENS']
  if(env.NODE_ENV==='production'&&keys.some(key=>!env[key]?.trim()))throw new Error('PRODUCTION_CONFIG_REQUIRED')
  const read=(key:string,fallback:number,min:number,max:number)=>{const value=Number(env[key]?.trim()||fallback);if(!Number.isInteger(value)||value<min||value>max)throw new Error('MODEL_CAPABILITY_CONFIG_INVALID');return value}
  const budget=(prefix:string,windowDefault:number,outputDefault:number,model:string|undefined,base:string|undefined,credential:string|undefined)=>{
    const window=read(`${prefix}_CONTEXT_TOKENS`,windowDefault,32000,2_000_000),output=read(prefix==='DEEPSEEK'?'DEEPSEEK_MAX_OUTPUT_TOKENS':`${prefix}_OUTPUT_TOKENS`,outputDefault,1024,131072)
    if(output+4096>=Math.min(window,500_000))throw new Error('MODEL_CAPABILITY_CONFIG_INVALID')
    return {window,output,namespace:identity({model,base,credential,window,output,formalOutput:2})}
  }
  return {llm:budget('DEEPSEEK',64000,16384,env.DEEPSEEK_MODEL_NAME,env.DEEPSEEK_BASE_URL,env.DEEPSEEK_API_KEY),zhihu:{
    fast:budget('ZHIHU_FAST',32000,8192,'zhida-fast-1p5',env.ZHIHU_API_BASE_URL,env.ZHIHU_ACCESS_SECRET),
    deep:budget('ZHIHU_DEEP',32000,8192,'zhida-thinking-1p5',env.ZHIHU_API_BASE_URL,env.ZHIHU_ACCESS_SECRET),
  }}
}
