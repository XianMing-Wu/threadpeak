import {pollResource,taskPollInterval,foregroundDelay} from './poll'
import { useEffect, useRef, useState } from 'react'
import { ProductWorkspace } from '../components/Shell'
import { Composer } from '../components/Composer'
import { MarkdownMath } from '../lib/MarkdownMath'
import { Icon } from '../icons'
import { productRequest, type TaskView } from './client'
import { pathLaunchAttachments } from '../path-planning/path-run-client'
import { refreshProductLibrary } from './library'

type Snapshot={id:string;revision:number;data:{title:string;messages:{id:string;role:'user'|'assistant';text:string;incomplete?:boolean}[]};job:TaskView|null}
export function OrdinaryChat({chatId,question,initialDepth}:{chatId:string;question:string;initialDepth:'fast'|'deep'}){
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[value,setValue]=useState(''),[depth,setDepth]=useState(initialDepth),[notice,setNotice]=useState(''),[sending,setSending]=useState(false)
  const [reconnect,setReconnect]=useState(0)
  const mounted=useRef(true)
  const live=useRef<Snapshot|null>(null)
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
  const lock=useRef(false),scroll=useRef<HTMLDivElement>(null),follow=useRef(true)
  const accept=(next:Snapshot)=>{if(mounted.current&&(!live.current||live.current.id!==next.id||live.current.revision<next.revision)){live.current=next;setSnapshot(next)}}
  useEffect(()=>{
    const abort=new AbortController()
    const poll=(id:string)=>pollResource(async()=>{
      const next=await productRequest<Snapshot|{unchanged:true}>(`/api/v2/resources/${id}?after=${live.current?.id===id?live.current.revision:0}`,{signal:abort.signal})
      if(abort.signal.aborted)return false
      if(!('unchanged' in next))accept(next);setNotice('')
    },{signal:abort.signal,intervalMs:()=>taskPollInterval(live.current?.job?.status),wait:foregroundDelay,onError:(_error,stopped)=>setNotice(stopped?'连接暂停，点击重新连接继续。':'正在重新连接，内容仍然保留。')})
    void productRequest<Snapshot>('/api/v2/chats/enter',{method:'POST',body:{chatId,question,depth:initialDepth,attachments:pathLaunchAttachments.get(chatId)??[]},key:`chat:${chatId}`,signal:abort.signal}).then(next=>{if(!abort.signal.aborted){accept(next);void poll(next.id);void refreshProductLibrary().catch(()=>{})}}).catch(e=>{if(!abort.signal.aborted)setNotice(e.message)})
    return()=>{abort.abort()}
  },[chatId,reconnect])
  useEffect(()=>{if(snapshot?.job?.status==='completed')void refreshProductLibrary().catch(()=>{})},[snapshot?.job?.id,snapshot?.job?.status])
  const busy=sending||!!snapshot?.job&&['queued','running'].includes(snapshot.job.status)
  useEffect(()=>{if(follow.current)scroll.current?.scrollTo({top:scroll.current.scrollHeight})},[snapshot?.data.messages.length,snapshot?.job?.draft])
  async function send(){
    if(!snapshot||busy||snapshot.job?.status==='waiting'||!value.trim()||lock.current)return
    lock.current=true;setSending(true);const submitted=value
    try{accept(await productRequest(`/api/v2/chats/${snapshot.id}/reply`,{method:'POST',body:{question:submitted.trim(),depth}}));if(!mounted.current)return;setValue(v=>v===submitted?'':v);setNotice('')}catch(e){if(mounted.current)setNotice(e instanceof Error?e.message:'暂时未发送，你的输入仍然保留。')}finally{lock.current=false;if(mounted.current)setSending(false)}
  }
  async function action(name:string){if(!snapshot)return;try{accept(await productRequest(`/api/v2/resources/${snapshot.id}/${name}`,{method:'POST',body:{}}))}catch(e){if(mounted.current)setNotice(e instanceof Error?e.message:'暂时没有完成。')}}
  return <ProductWorkspace active="paths" page="chat"><main className="query-chat">
    <header className="query-chat-header"><div><button aria-label="返回首页" onClick={()=>location.hash='home'}><Icon name="back" size={18}/></button><h1>{snapshot?.data.title??question}</h1></div><button className="new-chat-only" onClick={()=>location.hash='home'}><Icon name="new-chat" size={17}/>新对话</button></header>
    {(notice||snapshot?.job?.status==='waiting')&&<div className="lp-runtime-notice" role="status">{notice||snapshot?.job?.phase}{notice&&<button onClick={()=>setReconnect(n=>n+1)}>重新连接</button>}{snapshot?.job?.status==='waiting'&&snapshot.job.recoverable&&<button onClick={()=>void action('resume')}>继续完成</button>}{snapshot?.job?.status==='waiting'&&<button onClick={()=>void action('cancel')}>停止本次任务</button>}</div>}
    <section className="query-chat-body" ref={scroll} onScroll={()=>{const el=scroll.current;if(el)follow.current=el.scrollHeight-el.scrollTop-el.clientHeight<100}}><div className="query-chat-flow">
      {snapshot?.data.messages.map(m=>m.role==='user'?<div className="query-user-bubble" key={m.id}>{m.text}</div>:<article className="chat-answer" key={m.id}><MarkdownMath source={m.text}/>{m.incomplete&&<small>已停止 · 回答尚未完成</small>}</article>)}
      {busy&&<article className="chat-answer" aria-busy="true">{snapshot?.job?.draft?<MarkdownMath source={snapshot.job.draft}/>:<p role="status">{snapshot?.job?.phase??'正在读取对话'}</p>}</article>}
    </div></section>
    <div className="query-chat-composer"><Composer compact value={value} onChange={setValue} onSend={()=>void send()} showAttachment={false} thinkingDepth={depth} onThinkingDepth={setDepth} busy={busy} sendDisabled={sending||snapshot?.job?.status==='waiting'} onStop={()=>void action('cancel')}/></div>
  </main></ProductWorkspace>
}
