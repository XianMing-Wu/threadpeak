import {pollResource} from './poll'
import {useEffect,useState} from 'react'
import {MarkdownMath} from '../lib/MarkdownMath'
import {productRequest, type TaskView} from './client'
import {READING_POLICY_VERSION} from '@threadpeak/contracts/reading-policy'
import {hasMissingSourceExcerptMath} from '@threadpeak/contracts/source-image'
type Presentation={id:string;data:{status:string;metadata:{avatar?:string;badge?:string;badgeIcon?:string;comments?:string[];commentCount?:number};reading?:{kind:'ai-formula';content:string}};job:TaskView|null}
const pending=new Map<string,Promise<Presentation>>()
let metadataQueue=Promise.resolve()
function permitted(url?:string){try{const u=new URL(url!);return u.protocol==='https:'&&(u.hostname==='zhihu.com'||u.hostname.endsWith('.zhihu.com'))}catch{return false}}
function load(url:string,includeReading:boolean,retry=false){
  const key=`v${READING_POLICY_VERSION}:${localStorage.getItem('tp-server-workspace')??''}:${includeReading}:${url}`
  if(retry)pending.delete(key)
  if(!pending.has(key)){
    const run=async()=>{
      let value=await productRequest<Presentation>('/api/v2/sources/presentation',{method:'POST',body:{url,includeReading,readingVersion:READING_POLICY_VERSION}})
      if(retry&&value.job?.status==='waiting')value=await productRequest<Presentation>(`/api/v2/resources/${value.id}/resume`,{method:'POST',body:{}})
      let failure:unknown
      if(value.job&&['queued','running'].includes(value.job.status))await pollResource(async()=>{
        value=await productRequest<Presentation>(`/api/v2/resources/${value.id}`)
        return ['queued','running'].includes(value.job?.status??'')
      },{signal:new AbortController().signal,onError:(error,stopped)=>{if(stopped)failure=error}})
      if(failure)throw failure
      if(value.job?.status!=='completed')throw new Error('资料仍在整理')
      return value
    }
    // A requested reading must not queue behind every avatar in the author catalog.
    const task=includeReading?run():metadataQueue.then(run)
    pending.set(key,task)
    if(!includeReading)metadataQueue=task.then(()=>{},()=>{})
    void task.catch(()=>{if(pending.get(key)===task)pending.delete(key)})
  }
  return pending.get(key)!
}
export function useSourcePresentation(url?:string,enabled=true,includeReading=false){
  const signature=`${READING_POLICY_VERSION}:${url}:${includeReading}`, [record,setRecord]=useState<{signature:string;value:Presentation}>();const [failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0)
  useEffect(()=>{setRecord(undefined);setFailed(false);if(!enabled||!permitted(url))return;let live=true;void load(url!,includeReading,attempt>0).then(v=>{if(live)setRecord({signature,value:v})}).catch(()=>{if(live)setFailed(true)});return()=>{live=false}},[url,enabled,includeReading,attempt])
  return {value:enabled&&record?.signature===signature?record.value:undefined,failed,retry:()=>setAttempt(n=>n+1)}
}
export function SourceReading({url,source,curated,allowPresentation=true}:{url?:string;source:string;curated?:string;allowPresentation?:boolean}){
  const missing=hasMissingSourceExcerptMath(source),{value,failed,retry}=useSourcePresentation(url,allowPresentation&&missing&&!curated,true)
  const reading=curated?{content:curated}:value?.data.reading
  if(!missing&&!curated)return <MarkdownMath source={source} sourceExcerpt/>
  return <div className="tp-source-reading">
    <div className="tp-source-reading-label">{curated?'编选讲解':reading?'AI 公式讲解':'原摘要缺少部分公式'}<span>{curated?'根据资料与目标编选，非作者原文':reading?'根据摘要主题整理，非作者原文':'原始内容保留在下方'}</span></div>
    {reading?<MarkdownMath source={reading.content}/>:<div className="tp-source-reading-state" role="status">
      {!allowPresentation||!permitted(url)?'可前往原文查看完整内容。':failed||value?<><p>公式讲解尚未准备好。</p><button type="button" onClick={retry}>继续整理公式</button></>:<p>正在整理完整的公式讲解…</p>}
    </div>}
    <details><summary>查看原始摘要</summary><MarkdownMath source={source} sourceExcerpt/></details>
  </div>
}
