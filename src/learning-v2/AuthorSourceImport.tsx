import {useEffect,useRef,useState} from 'react'
import type {NetworkEvidence} from '../../packages/contracts/src/authors'
import {authorLearningHref} from '../../packages/contracts/src/authors'
import {productRequest,type LearningSnapshot} from './client'
import {refreshProductLibrary,useProductLibrary} from './library'
import {Glyph} from './atoms'

export function SourceImport({evidence,initialLearningId,onImported,onClose}:{evidence:NetworkEvidence;initialLearningId?:string;onImported?:()=>void;onClose:()=>void}){
  const {data,error,reload}=useProductLibrary(),[target,setTarget]=useState(initialLearningId??''),[state,setState]=useState<'idle'|'busy'|'waiting'>('idle'),[message,setMessage]=useState(''),[addedTo,setAddedTo]=useState(''),abort=useRef<AbortController|null>(null)
  useEffect(()=>()=>abort.current?.abort(),[])
  useEffect(()=>{if(!target&&data?.knowledge.length===1)setTarget(data.knowledge[0]!.id)},[data,target])
  const destination=data?.knowledge.find(k=>k.id===target)

  async function wait(id:string,resume=false){
    abort.current?.abort();const controller=new AbortController();abort.current=controller;setState('busy');setMessage('正在核对与这个概念的相关性…')
    try{
      let snapshot=await productRequest<LearningSnapshot>(resume?`/api/v2/resources/${id}/resume`:`/api/v2/learning/${id}/import-author-source`,{method:'POST',body:resume?{}:{authorId:evidence.authorId,evidenceId:evidence.evidenceId},signal:controller.signal})
      const jobId=snapshot.job?.id
      while(!controller.signal.aborted){
        if(snapshot.job?.id!==jobId){setMessage('任务状态已更新，可以返回学习页查看。');setState('idle');return}
        if(snapshot.job?.status==='completed'){
          const result=snapshot.data.importResult;if(result&&result.jobId===jobId&&result.status!=='unrelated')setAddedTo(id);setState('idle');setMessage(result&&result.jobId===jobId?(result.status==='unrelated'?'这篇资料偏离当前概念，未加入学习。':result.status==='already-present'?'这篇资料已经在当前学习里。':'已加入，下一次对话可以引用这篇文章。'):'操作已完成。');void refreshProductLibrary().catch(()=>{});onImported?.();return
        }
        if(snapshot.job?.status==='waiting'){setState('waiting');setMessage('核对尚未完成，已经保留进度。');return}
        if(snapshot.job?.status==='cancelled'){setState('idle');setMessage('本次核对已停止。');return}
        await new Promise<void>(resolve=>{const done=()=>{clearTimeout(timer);controller.signal.removeEventListener('abort',done);resolve()};const timer=setTimeout(done,900);controller.signal.addEventListener('abort',done,{once:true})})
        if(controller.signal.aborted)return
        snapshot=await productRequest<LearningSnapshot>(`/api/v2/resources/${id}`,{signal:controller.signal})
      }
    }catch(e){if(!controller.signal.aborted){setState('idle');setMessage(e instanceof Error?e.message:'暂时未完成。')}}
  }
  return <>
    <div className="au-dialog-body au-connect-body">
      <div className="au-chosen-source"><Glyph name="document" size={19}/><div><small>将这篇资料加入学习</small><strong>{evidence.title}</strong><span>{evidence.authorName}</span></div></div>
      <h3 className="au-section-title">加入哪个概念？</h3><p className="au-muted">通过相关性核对后，这篇资料会出现在该概念的资料列表和知识脉络中，后续提问时可以引用。</p>
      {error?<p role="alert">{error} <button className="au-link-button" onClick={()=>void reload()}>重试</button></p>:!data?<p role="status">正在读取你的学习概念…</p>:!data.knowledge.length?<div className="au-quiet-empty"><Glyph name="book"/><p>先从学习路径打开一个概念，再把这篇资料加入其中。</p><a className="au-secondary" href="#paths" onClick={onClose}>查看学习路径</a></div>:<fieldset className="au-destinations" disabled={state!=='idle'}><legend className="au-sr-only">选择接收这篇资料的概念</legend>{data.knowledge.map(k=><label key={k.id} className={k.id===target?'is-selected':''}><input type="radio" name="source-destination" value={k.id} checked={k.id===target} onChange={()=>{setTarget(k.id);setMessage('')}}/><span><strong>{k.title}</strong><small>{data.paths.find(p=>p.id===k.routeId||p.document?.id===k.routeId)?.goal??'我的学习路径'}{k.id===initialLearningId?' · 当前正在学习':''}</small></span><Glyph name={k.id===target?'check':'book'} size={16}/></label>)}</fieldset>}
      {message&&<p className="au-import-status" role="status">{message}</p>}
    </div>
    <footer className="au-sheet-footer">{destination?<span className="au-destination-summary">加入「{destination.title}」</span>:<span className="au-muted">选择一个概念后继续</span>}{addedTo===target&&destination?<a className="au-primary" href={authorLearningHref(target,evidence.evidenceId)} onClick={onClose}>去学习<Glyph name="arrow" size={15}/></a>:<button className="au-primary" disabled={!destination||state==='busy'} onClick={()=>void wait(target,state==='waiting')}><Glyph name={state==='busy'?'clock':'plus'} size={15}/>{state==='busy'?'正在核对…':state==='waiting'?'继续核对':'加入这篇资料'}</button>}</footer>
  </>
}
