import {editEntry,applyEditEntry,type EditEntry} from './edit-history'
import {pollResource,taskPollInterval,foregroundDelay} from './poll'
import {mergeLearningSnapshot} from './snapshot'
import {SHOWCASE_VERSION} from '../showcase/content'
import { useEffect, useRef, useState } from 'react'
import { ArticlePanel } from './Articles'
import { ChatPanel } from './Chat'
import { LearningHeader, PaneDivider } from './Navigation'
import { KnowledgeGraph, type PendingReply } from './Graph'
import { LearningData } from './data'
import { Glyph, IconButton, StatusPill } from './atoms'
import type { GraphNode, Phase } from './model'
import { productRequest, readLearning, ApiError, type LearningSnapshot } from './client'
import { refreshProductLibrary } from './library'
import {LearningSchema,validateTree,type LearningState} from '@threadpeak/contracts/learning-v2'
import {nodeFieldPatch} from '@threadpeak/contracts/node-edits'
import './learning.css'

export function LearningWorkspace({routeId,conceptId,initialView='research',resourceId,example,onBack}:{routeId:string;conceptId:string;initialView?:'research'|'graph';resourceId?:string;example?:LearningState;onBack?:()=>void}){
  const [snapshot,setSnapshot]=useState<LearningSnapshot|null>(null),[notice,setNotice]=useState(''),[offline,setOffline]=useState(false)
  const [view,setView]=useState(initialView),[depth,setDepth]=useState<'fast'|'deep'>('fast'),[selected,setSelected]=useState<string[]>([]),[detail,setDetail]=useState<string|null>(null)
  const [saveState,setSaveState]=useState<'idle'|'saving'|'saved'|'error'>('idle')
  const [history,setHistory]=useState(false),[split,setSplit]=useState(53),[phonePane,setPhonePane]=useState('material'),[focusNode,setFocusNode]=useState<string|null>(()=>new URLSearchParams(location.hash.split('?')[1]??'').get('node'))
  const [editingNodes,setEditingNodes]=useState<GraphNode[]|null>(null),[past,setPast]=useState<EditEntry[]>([]),[future,setFuture]=useState<EditEntry[]>([]),[sending,setSending]=useState(false)
  const body=useRef<HTMLDivElement>(null),live=useRef(snapshot),saveChain=useRef(Promise.resolve()),mounted=useRef(true),lastCompleted=useRef(''),sendingRef=useRef(false),unsaved=useRef<GraphNode[]|null>(null)
  const [reconnect,setReconnect]=useState(0)
  function accept(raw:unknown){const next=mergeLearningSnapshot(live.current,readLearning(raw,live.current));if(mounted.current){live.current=next;setSnapshot(next);setOffline(false)}return next}
  useEffect(()=>{
    const abort=new AbortController();mounted.current=true
    if(example){
      let data=example
      try{const saved=sessionStorage.getItem(`tp-example-learning-v2:${SHOWCASE_VERSION}:${routeId}:${conceptId}`);if(saved){const parsed=LearningSchema.parse(JSON.parse(saved));validateTree(parsed.nodes);if(parsed.routeId===routeId&&parsed.conceptId===conceptId)data=parsed}}catch{/* A damaged preview does not affect a personal workspace. */}
      accept({id:`example:${routeId}:${conceptId}`,kind:'learning',revision:1,data,job:null})
      return()=>{mounted.current=false}
    }
    const poll=(id:string)=>pollResource(async()=>{
      const update=await productRequest<LearningSnapshot|{unchanged:true}>(`/api/v2/resources/${encodeURIComponent(id)}?after=${live.current?.revision??0}`,{signal:abort.signal})
      if(abort.signal.aborted)return false
      if(!('unchanged' in update))accept(update);else setOffline(false)
    },{signal:abort.signal,intervalMs:()=>taskPollInterval(live.current?.job?.status),wait:foregroundDelay,onError:(_error,stopped)=>{setOffline(true);if(stopped)setNotice('连接暂停，已有内容仍然保留。点击重新连接继续。')}})
    void (async()=>{
      try{const raw=resourceId?await productRequest(`/api/v2/resources/${encodeURIComponent(resourceId)}`,{signal:abort.signal}):await productRequest('/api/v2/learning/enter',{method:'POST',body:{routeId,conceptId,depth:'fast'},key:`enter:${routeId}:${conceptId}`,signal:abort.signal});if(abort.signal.aborted)return;const s=accept(raw);void poll(s.id)}catch(e){if(!abort.signal.aborted)setNotice(e instanceof ApiError&&e.status===404?'找不到这个概念。':e instanceof Error?e.message:'暂时未连接，请稍后刷新。')}
    })()
    return()=>{mounted.current=false;abort.abort()}
  },[routeId,conceptId,resourceId,example,reconnect])
  useEffect(()=>{if(snapshot?.job?.status==='completed'&&lastCompleted.current!==snapshot.job.id){lastCompleted.current=snapshot.job.id;void refreshProductLibrary().catch(()=>{});setPast([]);setFuture([])}},[snapshot?.job?.id,snapshot?.job?.status])
  const state=snapshot?.data,job=snapshot?.job
  useEffect(()=>{
    const followLink=()=>{const node=new URLSearchParams(location.hash.split('?')[1]??'').get('node')
      if(node&&live.current?.data.nodes.some(n=>n.id===node)){setView('graph');setFocusNode(node);setSelected([node]);setPhonePane('material')}}
    followLink();window.addEventListener('hashchange',followLink)
    return()=>window.removeEventListener('hashchange',followLink)
  },[state?.routeId,state?.conceptId])
  useEffect(()=>{if(state?.importResult?.jobId&&job?.status==='completed')setNotice(state.importResult.status==='unrelated'?'这篇材料偏离当前概念，未加入学习。':state.importResult.status==='added'?'新材料已加入，可以选择它继续提问。':'这篇文章已经在当前学习里。')},[state?.importResult?.jobId])
  function findPerson(authorId?:string){
    if(!live.current)return
    const params=new URLSearchParams({learning:live.current.id})
    if(authorId){params.set('view','network');params.set('author',authorId)}
    else for(const id of selected)params.append('node',id)
    location.hash=`authors?${params}`
  }
  const running=!!job&&['queued','running'].includes(job.status),busy=running||sending||job?.status==='waiting'
  const nodes=editingNodes??state?.nodes??[]
  const conversation=state?.conversations.find(c=>c.id===state.active)
  function selectNode(id:string,multi=false){setSelected(s=>multi?s.includes(id)?s.filter(v=>v!==id):[...s,id]:[id])}
  function openArticle(id:string){setView('research');setDetail(id);setSelected([id]);setPhonePane('material')}
  function saveExample(data:LearningState){
    validateTree(data.nodes)
    const s=live.current;if(!s)return
    accept({...s,data,revision:s.revision+1})
    try{sessionStorage.setItem(`tp-example-learning-v2:${SHOWCASE_VERSION}:${routeId}:${conceptId}`,JSON.stringify(data))}catch{setNotice('当前窗口无法保存示例编辑，请复制需要保留的内容。')}
  }
  async function command(kind:string,question?:string,ids=selected){
    if(!live.current||sendingRef.current)return false
    if(example){
      if(kind==='new-conversation'){const id=crypto.randomUUID();saveExample({...live.current.data,active:id,conversations:[...live.current.data.conversations,{id,title:'新的示例对话',date:'示例',messages:[]}]});setSelected([]);setDetail(null);setHistory(false);return true}
      setNotice('这是示例内容。制定自己的路线后，即可使用 AI 和博主继续学习。');return false
    }
    sendingRef.current=true;setSending(true)
    await saveChain.current
    if(!mounted.current){sendingRef.current=false;return false}
    const s=live.current!
    if(unsaved.current){setNotice('请先保存或处理这次卡片编辑，再发送问题。');sendingRef.current=false;setSending(false);return false}
    setNotice('')
    try{accept(await productRequest(`/api/v2/learning/${s.id}/commands`,{method:'POST',body:{kind,question,selected:ids,conversationId:kind==='new-conversation'?crypto.randomUUID():s.data.active,depth}}));if(!mounted.current)return false;if(kind==='new-conversation'){setSelected([]);setDetail(null);setHistory(false)}return true}catch(e){if(mounted.current)setNotice(e instanceof Error?e.message:'操作暂时未完成。');return false}finally{sendingRef.current=false;if(mounted.current)setSending(false)}
  }
  async function taskAction(action:'cancel'|'resume'){
    const s=live.current;if(!s)return
    try{accept(await productRequest(`/api/v2/resources/${s.id}/${action}`,{method:'POST',body:{}}));if(mounted.current)setNotice('')}catch(e){if(mounted.current)setNotice(e instanceof Error?e.message:'操作暂时未完成。')}
  }
  function normalizeCustom(next:GraphNode[]){
    const known=new Set([...nodes.map(n=>n.id),...(state?.conversations.flatMap(c=>c.messages.flatMap(m=>m.paragraphs?.map(p=>p.id)??[]))??[])])
    return next.map(n=>known.has(n.id)||n.type==='custom'?n:{id:n.id,type:'custom' as const,title:n.title,text:n.text,parents:n.parents,sources:[],color:n.color,stroke:n.stroke})
  }
  function saveNodes(next:GraphNode[]){
    if(example&&live.current){saveExample({...live.current.data,nodes:next});setEditingNodes(null);return}
    const base=unsaved.current??live.current?.data.nodes??[]
    unsaved.current=next;setEditingNodes(next);setSaveState('saving')
    saveChain.current=saveChain.current.then(async()=>{
      const s=live.current;if(!s)return
      const patch=nodeFieldPatch(base,next)
      try{const saved=accept(await productRequest(`/api/v2/learning/${s.id}/nodes`,{method:'PATCH',body:{...(patch?{patch}:{nodes:next,baseNodes:base}),revision:s.revision}}));if(unsaved.current===next){unsaved.current=null;if(mounted.current)setSaveState('saved')}if(mounted.current)setEditingNodes(current=>current===next?null:current)}catch(e){
        if(mounted.current)setSaveState('error')
        // Keep the unsaved edit visible; never overwrite a concurrent server edit silently.
        if(mounted.current)setNotice(e instanceof ApiError&&['REVISION_CONFLICT','NODE_EDIT_CONFLICT'].includes(e.code)?'这张卡片已在另一处更新。你的编辑还在，请保留当前版本或使用已保存版本。':e instanceof Error?e.message:'编辑还没保存，请保持页面打开。')
      }
    })
  }
  function changeGraph(next:GraphNode[],_label?:string){if(busy)return;const normalized=normalizeCustom(next);setPast(p=>[...p.slice(-39),editEntry(nodes,normalized)]);setFuture([]);saveNodes(normalized)}
  function undo(){const entry=past.at(-1);if(!entry)return;try{const previous=applyEditEntry(entry,nodes,true);setFuture(f=>[entry,...f]);setPast(p=>p.slice(0,-1));saveNodes(previous)}catch{setNotice('这次编辑涉及的卡片已在另一处改变，无法自动撤销。当前内容仍然保留。')}}
  function redo(){const entry=future[0];if(!entry)return;try{const next=applyEditEntry(entry,nodes);setPast(p=>[...p.slice(-39),entry]);setFuture(f=>f.slice(1));saveNodes(next)}catch{setNotice('这次编辑涉及的卡片已在另一处改变，无法自动重做。当前内容仍然保留。')}}
  async function copy(text:string){try{await navigator.clipboard.writeText(text)}catch{setNotice('可以选中文字手动复制。')}}
  const pending:PendingReply[]=running&&job?.kind!=='learning.enter'&&job?.kind!=='learning.import'&&job?.basisIds?.length===1&&nodes.some(n=>n.id===job.basisIds[0])?[{id:`pending-${job.id}`,mode:job.kind==='learning.author'?'author':'ai',question:'',parents:[job.basisIds[0]!],text:'',status:job.phase}]:[]
  const phase:Phase=state?.phase??'searching'
  if(!state||!conversation)return <div className="lp-workspace"><div className="lp-empty-state">{notice?<><p>{notice}</p><button onClick={()=>location.hash='paths'}>返回路线</button></>:<StatusPill busy>正在读取学习内容</StatusPill>}</div></div>
  return <LearningData.Provider value={{articles:state.articles,concept:state.title,example:!!example}}><div className="lp-workspace">
    <LearningHeader eyebrow={example?'示例学习':'刘看山陪你学'} backLabel={example?'返回上一级':resourceId?'返回知识脉络':'返回3D路线'} view={view} graphReady={nodes.length>0} historyOpen={history} onChange={setView} onBack={onBack??(()=>{location.hash=resourceId?'knowledge':'path-3d'})} onFindPerson={example?undefined:()=>findPerson()} onHistory={()=>setHistory(!history)} onNew={()=>void command('new-conversation')}/>
    {example&&<div className="lp-example-note"><span>示例学习</span><a href="#home">开始我的学习 <Glyph name="chevron" size={13}/></a></div>}
    {(offline||notice||job?.status==='waiting')&&<div className="lp-runtime-notice" role="status"><span>{notice|| (offline?'正在重新连接，内容仍然保留。':job?.phase)}</span>{job?.status==='waiting'&&<>{job.recoverable&&<button onClick={()=>void taskAction('resume')}>继续完成</button>}<button onClick={()=>void taskAction('cancel')}>停止本次任务</button></>}{unsaved.current&&<><button onClick={()=>{const next=unsaved.current!;unsaved.current=null;saveNodes(next)}}>保留当前版本</button><button onClick={()=>{unsaved.current=null;setEditingNodes(null);setNotice('')}}>使用已保存版本</button></>}{offline&&<button onClick={()=>{setNotice('');setReconnect(n=>n+1)}}>重新连接</button>}{notice&&<button onClick={()=>setNotice('')} aria-label="关闭提示">×</button>}</div>}
    <div className="lp-phone-tabs"><button aria-pressed={phonePane==='material'} onClick={()=>setPhonePane('material')}>{view==='research'?'文章':'知识脉络'}</button><button aria-pressed={phonePane==='chat'} onClick={()=>setPhonePane('chat')}>对话</button></div>
    <main className="lp-body" ref={body} style={{'--lp-split':`${split}%`} as React.CSSProperties} data-phone-pane={phonePane}>
      <section className="lp-material-pane"><div className="lp-material-view" hidden={view!=='research'}><ArticlePanel onAuthor={example?undefined:id=>findPerson(id)} phase={phase} detail={detail} selected={selected} onOpen={openArticle} onBack={()=>setDetail(null)} onToggle={id=>selectNode(id,true)} canRetry={!!job?.recoverable} onRetry={()=>void taskAction('resume')}/></div>
        {!!nodes.length&&<div className="lp-material-view" hidden={view!=='graph'}>{saveState!=='idle'&&<div className="lp-save-status" role="status"><StatusPill busy={saveState==='saving'}>{saveState==='saving'?'正在保存卡片':saveState==='saved'?'卡片已保存':'卡片尚未保存'}</StatusPill></div>}<KnowledgeGraph active={view==='graph'} nodes={nodes} selected={selected} onSelect={selectNode} onSelection={setSelected} onPromptSubmit={(q,mode,ids)=>busy?Promise.resolve(false):command(mode==='author'?'author':'reply',q,ids)} submitError={notice} pending={pending} onChange={changeGraph} onUndo={undo} onRedo={redo} canUndo={!!past.length} canRedo={!!future.length} onStop={()=>void taskAction('cancel')} depth={depth} onDepth={setDepth} busy={busy} onCopy={copy} onSource={openArticle} focusId={focusNode}/></div>}
      </section><PaneDivider split={split} onChange={setSplit} container={body}/>
      <ChatPanel task={job?.conversationId===state.active?job:undefined} paused={job?.status==='waiting'||(running&&job?.conversationId!==state.active)} conversation={conversation} selected={selected} nodes={nodes} depth={depth} onDepth={setDepth} onRemove={id=>setSelected(s=>s.filter(n=>n!==id))} onClear={()=>setSelected([])} onSend={q=>command('reply',q)} onStop={()=>void taskAction('cancel')} mode="ai" onMode={()=>{}} focusToken={0} phase={running?phase:phase==='empty'?'empty':'ready'} draft={job?.conversationId===state.active?job?.draft??'':''} busy={sending||(running&&job?.conversationId===state.active)} authorBusy={job?.kind==='learning.author'&&running} onSource={openArticle} onNode={id=>{setView('graph');setFocusNode(id);setSelected([id]);setPhonePane('material')}} onCopy={copy} onRetry={()=>void taskAction('resume')}/>
    </main>
    {history&&<><button className="lp-overlay-scrim" aria-label="关闭对话历史" onClick={()=>setHistory(false)}/><aside className="lp-history lp-enter" aria-label="对话历史"><header><h2>这个概念的对话</h2><IconButton icon="close" label="关闭历史" onClick={()=>setHistory(false)}/></header><p>对话分别保存，知识脉络持续积累。</p>{[...state.conversations].reverse().map(c=><button className={`lp-history-item ${c.id===state.active?'is-active':''}`} key={c.id} onClick={async()=>{if(example){saveExample({...state,active:c.id});setHistory(false);setSelected([]);return}try{accept(await productRequest(`/api/v2/learning/${snapshot!.id}/commands`,{method:'POST',body:{kind:'activate-conversation',conversationId:c.id,depth}}));setHistory(false);setSelected([])}catch(e){setNotice(e instanceof Error?e.message:'暂时未打开。')}}}><Glyph name="message" size={17}/><span><strong>{c.title}</strong><small>{c.messages.filter(m=>m.role==='user').length} 个问题</small></span></button>)}</aside></>}
  </div></LearningData.Provider>
}
