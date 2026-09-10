import {pollResource} from './poll'
import {useEffect,useState} from 'react'
import {MarkdownMath} from '../lib/MarkdownMath'
import {productRequest, type TaskView} from './client'
import {READING_POLICY_VERSION} from '@threadpeak/contracts/reading-policy'
import {hasMissingSourceExcerptMath} from '@threadpeak/contracts/source-image'
type Presentation={id:string;data:{status:string;metadata:{avatar?:string;badge?:string;badgeIcon?:string;comments?:string[];commentCount?:number};reading?:{kind:'ai-formula';content:string}};job:TaskView|null}
type PendingPresentation={controller:AbortController;users:number;task:Promise<Presentation>;settled:boolean}
const pending=new Map<string,PendingPresentation>()
let metadataQueue=Promise.resolve()
function permitted(url?:string){try{const u=new URL(url!);return u.protocol==='https:'&&(u.hostname==='zhihu.com'||u.hostname.endsWith('.zhihu.com'))}catch{return false}}
function subscribe(url:string,includeReading:boolean,retry=false,source?:string){
  const key=`v${READING_POLICY_VERSION}:${localStorage.getItem('tp-server-workspace')??''}:${includeReading}:${url}:${source??''}`
  if(retry&&pending.get(key)?.settled)pending.delete(key)
  let entry=pending.get(key)
  if(!entry){
    const controller=new AbortController(),signal=controller.signal
    const run=async()=>{
      signal.throwIfAborted()
      let value=await productRequest<Presentation>('/api/v2/sources/presentation',{method:'POST',body:{url,includeReading,readingVersion:READING_POLICY_VERSION},signal})
      if(retry&&value.job?.status==='waiting')value=await productRequest<Presentation>(`/api/v2/resources/${value.id}/resume`,{method:'POST',body:{},signal})
      let failure:unknown
      if(value.job&&['queued','running'].includes(value.job.status))await pollResource(async()=>{
        value=await productRequest<Presentation>(`/api/v2/resources/${value.id}`,{signal})
        return ['queued','running'].includes(value.job?.status??'')
      },{signal,onError:(error,stopped)=>{if(stopped)failure=error}})
      signal.throwIfAborted()
      if(failure)throw failure
      if(value.job?.status!=='completed')throw new Error('资料仍在整理')
      return value
    }
    const task=includeReading?run():metadataQueue.then(run)
    const created={controller,users:0,task,settled:false};entry=created;pending.set(key,created)
    if(!includeReading)metadataQueue=task.then(()=>{},()=>{})
    void task.then(()=>{created.settled=true;for(const [id,item] of pending){if(pending.size<=32)break;if(item.settled&&!item.users)pending.delete(id)}},()=>{created.settled=true;if(pending.get(key)===created)pending.delete(key)})
  }
  entry.users++
  const current=entry
  return {task:current.task,release:()=>{if(--current.users===0&&!current.settled){current.controller.abort();if(pending.get(key)===current)pending.delete(key)}}}
}
if(typeof window!=='undefined')window.addEventListener('threadpeak:account-change',()=>{for(const entry of pending.values())entry.controller.abort();pending.clear()})
export function useSourcePresentation(url?:string,enabled=true,includeReading=false,source?:string){
  const signature=`${READING_POLICY_VERSION}:${url}:${includeReading}:${source??''}`, [record,setRecord]=useState<{signature:string;value:Presentation}>();const [failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0)
  useEffect(()=>{setRecord(undefined);setFailed(false);if(!enabled||!permitted(url))return;let live=true;const subscription=subscribe(url!,includeReading,attempt>0,source);void subscription.task.then(v=>{if(live)setRecord({signature,value:v})}).catch(()=>{if(live)setFailed(true)});return()=>{live=false;subscription.release()}},[url,enabled,includeReading,attempt,source])
  return {value:enabled&&record?.signature===signature?record.value:undefined,failed,retry:()=>setAttempt(n=>n+1)}
}
export function SourceReading({url,source,curated,allowPresentation=true}:{url?:string;source:string;curated?:string;allowPresentation?:boolean}){
  const missing=hasMissingSourceExcerptMath(source),{value,failed,retry}=useSourcePresentation(url,allowPresentation&&missing&&!curated,true,source)
  const reading=curated?{content:curated}:value?.data.reading
  if(!missing&&!curated)return <MarkdownMath source={source} sourceExcerpt/>
  return <div className="tp-source-reading">
    <div className="tp-source-reading-label">{curated?'学习导读':reading?'AI 公式讲解':'原摘要缺少部分公式'}<span>{curated?'刘看山 · 基于所选资料的讲解':reading?'根据摘要主题整理，非作者原文':'原始内容保留在下方'}</span></div>
    {reading?<MarkdownMath source={reading.content}/>:<div className="tp-source-reading-state" role="status">
      {!allowPresentation||!permitted(url)?'可前往原文查看完整内容。':failed||value?<><p>公式讲解尚未准备好。</p><button type="button" onClick={retry}>继续整理公式</button></>:<p>正在整理完整的公式讲解…</p>}
    </div>}
    <details><summary>查看原始摘要</summary><MarkdownMath source={source} sourceExcerpt/></details>
  </div>
}
