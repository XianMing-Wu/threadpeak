import type {LlmCompleteInput,LlmProvider} from '../agent-runtime/types.ts'
import type {TaskContext} from './worker.ts'

/** Stream the provider's actual reasoning into a separate, durable display channel. */
export async function modelCall(llm:LlmProvider,ctx:TaskContext,step:string,title:string,input:LlmCompleteInput,attempt=0){
  const id=`${step}:thinking:${ctx.job.fence}:${attempt}`
  for(const previous of ctx.job.activities??[]){
    if(previous.kind==='think'&&previous.step===step&&previous.id!==id&&previous.status==='running'){
      await ctx.activity(previous.id,'think',previous.title,'waiting',previous.detail,{thought:previous.thought,step})
    }
  }
  let thought='',lastWrite=0,accepting=true,writing=false
  const save=(status:'running'|'done'|'waiting')=>ctx.activity(id,'think',title,status,undefined,{thought,step})
  try{
    const result=await llm.complete({...input,onReasoning:text=>{
      if(!accepting||ctx.signal.aborted||!text.trim())return
      thought=text
      input.onReasoning?.(text)
      if(Date.now()-lastWrite<500)return
      lastWrite=Date.now()
      // TaskContext serializes and awaits these writes, including on cancellation.
      void save(writing?'done':'running').catch(()=>{})
    },onText:text=>{
      if(!accepting||ctx.signal.aborted)return
      if(text.trim()&&!writing){
        writing=true
        if(thought)void save('done').catch(()=>{})
        if(step.startsWith('R4'))void ctx.progress('正在整理学习路线').catch(()=>{})
      }
      input.onText?.(text)
    }})
    accepting=false
    if(result.kind==='completed'&&result.reasoning?.trim())thought=result.reasoning
    if(thought)await save(result.kind==='completed'?'done':'waiting')
    return result
  }catch(error){
    accepting=false
    if(thought&&!ctx.signal.aborted)await save('waiting')
    throw error
  }
}
