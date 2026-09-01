import { useEffect, useMemo, useState } from 'react'
import { Composer } from '../components/Composer'
import { ProductWorkspace } from '../components/Shell'
import { Icon } from '../icons'
import { clearActiveHistory, CHAT_LAUNCH_KEY, HISTORY_OPEN_EVENT } from '../history'
import { MarkdownMath } from '../lib/MarkdownMath'
import { VisualChart } from '../visuals/VisualChart'
import { buildVisualFrames } from '../visuals/specs'
import type { VisualSpec } from '../visuals/types'
import { resolveOrdinaryAnswer } from '../chat/resolve-ordinary-answer'
import { linkedRouteIntro } from '../workspace/catalog'
import { setActiveConversation } from '../workspace/nav'
import { ChatRoutePanel } from '../path-planning/chat-route-panel'
import {
  createHomeConversation,
  getConversation,
  getRoute,
  startLinkedConversation,
} from '../workspace/store'

export type ChatExperience = 'answer' | 'route' | 'visual'

export function launchChat(query:string,mode:ChatExperience) {
  const conversation=createHomeConversation(query,mode)
  sessionStorage.setItem(CHAT_LAUNCH_KEY,JSON.stringify({query,mode,conversationId:conversation.id,routeId:conversation.routeId}))
  setActiveConversation(conversation.id)
  location.hash='chat'
}

function readLaunch():{query:string;mode:ChatExperience;conversationId:string;routeId?:string} {
  try {
    const parsed=JSON.parse(sessionStorage.getItem(CHAT_LAUNCH_KEY)??'{}') as {query?:string;mode?:ChatExperience;conversationId?:string;routeId?:string}
    return {query:parsed.query?.trim()||'性价比高的显卡有哪些？',mode:parsed.mode??'answer',conversationId:parsed.conversationId??'',routeId:parsed.routeId}
  } catch {
    return {query:'性价比高的显卡有哪些？',mode:'answer',conversationId:''}
  }
}

function Thinking({label='生成最终回答'}:{label?:string}) {
  return <div className="chat-thinking" role="status"><strong>{label}</strong><span className="dots"><i/><i/><i/></span></div>
}

function OrdinaryAnswerUnavailable() {
  const resolution=resolveOrdinaryAnswer()
  return <article className="chat-answer" role="alert">
    <h2>{resolution.title}</h2>
    <p>{resolution.message}</p>
  </article>
}

const geminiFrames=['mindmap','sunburst','timeline'] as const

function selectVisualFrames(question:string):VisualSpec[] {
  const selected=buildVisualFrames(question).filter((item)=>geminiFrames.includes(item.kind))
  return geminiFrames.map((kind)=>selected.find((item)=>item.kind===kind)).filter((item):item is VisualSpec=>Boolean(item)).slice(0,3)
}

function VisualCard({spec}:{spec:VisualSpec}) {
  return <section className={`chat-visual-card is-${spec.kind}`} data-frame={spec.kind} data-template="gemini-interactive-v1">
    <div className="visual-stage-shell"><VisualChart spec={spec}/></div>
  </section>
}

function VisualGeneration({spec}:{spec:VisualSpec}) {
  return <section className="visual-generation-card" role="status" data-frame-pending={spec.kind}><div><strong>正在生成互动式可视化内容...</strong><p>正在构建代码，可能需要一分钟的时间</p></div><span className="visual-generation-mark"><i/></span></section>
}

function VisualProgress({spec}:{spec:VisualSpec}) {
  return <section className="gemini-viz-progress" role="status" data-frame-pending={spec.kind}><i/></section>
}

function VisualStreamingText({text,elapsed,startAt}:{text:string;elapsed:number;startAt:number}) {
  const length=Math.max(0,Math.min(text.length,Math.floor((elapsed-startAt)/28)))
  if(length===0)return null
  const complete=length===text.length
  return <div className="visual-stream-copy"><MarkdownMath source={text.slice(0,length)}/>{!complete&&<i aria-hidden="true"/>}</div>
}

function VisualStreamBlock({spec,visible}:{spec:VisualSpec;visible:boolean}) {
  const [ready,setReady]=useState(false)
  const [progress,setProgress]=useState(false)
  useEffect(()=>{
    setReady(false)
    setProgress(false)
    if(!visible)return
    const progressTimer=window.setTimeout(()=>setProgress(true),2200)
    const timer=window.setTimeout(()=>setReady(true),2600)
    return()=>{window.clearTimeout(progressTimer);window.clearTimeout(timer)}
  },[visible,spec.kind,spec.title])
  if(!visible)return null
  if(ready)return <VisualCard spec={spec}/>
  if(progress)return <VisualProgress spec={spec}/>
  return <VisualGeneration spec={spec}/>
}

export function VisualAnswer({query}:{query:string}) {
  const frames=useMemo(()=>selectVisualFrames(query),[query])
  const [elapsed,setElapsed]=useState(0)
  const topic=query.replace(/\s+/g,' ').trim() || '当前问题'
  const explanations=[
    `我先把“${topic}”中最适合图解的关系拆出来。第一张图聚焦${frames[0].focus}，你可以边看正文边等待图形完成。`,
    `接着补充第二个观察角度：${frames[1].focus}。这张图拥有自己的生成状态，不会与上一张图共用占位。`,
    `最后用时间线看先后关系：${frames[2].focus}。`,
  ]
  const streamCopy=[
    `# 交互演示：${topic}\n\n你可以在图里直接点击、拖动，亲自观察「${topic}」如何一层层展开。核心关系可以先写成 $$T(\\mathbf{u}+\\mathbf{v})=T(\\mathbf{u})+T(\\mathbf{v})$$。`,
    `${explanations[0]}文字会继续生成；遇到需要图解的位置时，对应的交互图会在自己的位置单独构建。`,
    `第一张图仍在构建时，我会继续向后输出文字，不会等待图形完成。`,
    `### 💡 思考小问题\n\n假设我们从最小对象出发，它的层次是：\n\n- 对象：先命名正在处理的东西\n- 关系：对象之间如何作用\n- 检验：用最小例子判断对错\n\n${explanations[1]}`,
    `第二张图也在自己的位置独立生成；正文此时仍会在后面持续追加。`,
    `${explanations[2]}三张图完成后仍各自独立，可在图内点选或拖动，生成计时彼此独立。`,
  ]
  let streamCursor=0
  const streamStarts=streamCopy.map((text)=>{const start=streamCursor;streamCursor+=text.length*28+120;return start})
  const firstFrameAt=streamStarts[2]-80
  const secondFrameAt=streamStarts[4]-80
  const thirdFrameAt=streamStarts[5]-80
  useEffect(()=>{
    setElapsed(0)
    const started=performance.now()
    const timer=window.setInterval(()=>{const next=performance.now()-started;setElapsed(next);if(next>=streamCursor)window.clearInterval(timer)},45)
    return()=>window.clearInterval(timer)
  },[query,streamCursor])
  return <article className="visual-answer"><VisualStreamingText text={streamCopy[0]} elapsed={elapsed} startAt={streamStarts[0]}/><section className="visual-stream-segment"><VisualStreamingText text={streamCopy[1]} elapsed={elapsed} startAt={streamStarts[1]}/><VisualStreamBlock spec={frames[0]} visible={elapsed>=firstFrameAt}/></section><VisualStreamingText text={streamCopy[2]} elapsed={elapsed} startAt={streamStarts[2]}/><section className="visual-stream-segment"><VisualStreamingText text={streamCopy[3]} elapsed={elapsed} startAt={streamStarts[3]}/><VisualStreamBlock spec={frames[1]} visible={elapsed>=secondFrameAt}/></section><VisualStreamingText text={streamCopy[4]} elapsed={elapsed} startAt={streamStarts[4]}/><section className="visual-stream-segment"><VisualStreamingText text={streamCopy[5]} elapsed={elapsed} startAt={streamStarts[5]}/><VisualStreamBlock spec={frames[2]} visible={elapsed>=thirdFrameAt}/></section></article>
}

export function ChatPage() {
  const launch=useMemo(readLaunch,[])
  const stored=launch.conversationId?getConversation(launch.conversationId):undefined
  const [query,setQuery]=useState(stored?.query??launch.query)
  const [experience,setExperience]=useState<ChatExperience>(stored?.experience??launch.mode)
  const [conversationId,setConversationId]=useState(stored?.id??launch.conversationId)
  const [routeId,setRouteId]=useState(stored?.routeId??launch.routeId??'')
  const [status,setStatus]=useState<'thinking'|'complete'>(stored?.routeReady||launch.mode!=='visual'?'complete':'thinking')
  const [value,setValue]=useState('')
  useEffect(()=>{if(conversationId)setActiveConversation(conversationId)},[conversationId])
  useEffect(()=>{
    if(experience==='route'||experience==='answer'){setStatus('complete');return}
    if(stored?.turns.length){setStatus('complete');return}
    setStatus('thinking')
    const timer=window.setTimeout(()=>setStatus('complete'),720)
    return()=>window.clearTimeout(timer)
  },[experience,query,stored?.turns.length])
  useEffect(()=>{
    const restore=()=>{
      const next=readLaunch()
      const conversation=next.conversationId?getConversation(next.conversationId):undefined
      setQuery(conversation?.query??next.query)
      setExperience(conversation?.experience??next.mode)
      setConversationId(conversation?.id??next.conversationId)
      setRouteId(conversation?.routeId??next.routeId??'')
      setValue('')
    }
    addEventListener(HISTORY_OPEN_EVENT,restore)
    return()=>removeEventListener(HISTORY_OPEN_EVENT,restore)
  },[])
  const followUp=()=>{const next=value.trim();if(!next)return;setQuery(next);setExperience(experience==='visual'?'visual':'answer');setValue('')}
  const newChat=()=>{
    if(routeId){
      const linked=startLinkedConversation(routeId)
      sessionStorage.setItem(CHAT_LAUNCH_KEY,JSON.stringify({query:linked.query,mode:'route',conversationId:linked.id,routeId}))
      setConversationId(linked.id)
      setQuery(linked.query)
      setExperience('route')
      setValue('')
      setActiveConversation(linked.id)
      return
    }
    sessionStorage.removeItem(CHAT_LAUNCH_KEY)
    clearActiveHistory()
    location.hash='home'
  }
  const conversation=conversationId?getConversation(conversationId):undefined
  const followupOrdinal=routeId?1+(conversation?.title.match(/对话 (\d+)/)?.[1]?Number(conversation.title.match(/对话 (\d+)/)?.[1])-1:0):1
  return <ProductWorkspace active="paths" page="chat">
    <main className="query-chat">
      <header className="query-chat-header"><div><button aria-label="返回首页" onClick={()=>location.hash='home'}><Icon name="back" size={18}/></button><h1>{query}</h1></div><button className="new-chat-only" onClick={newChat}><Icon name="new-chat" size={17}/>新对话</button></header>
      <section className="query-chat-body"><div className="query-chat-flow">
        <div className="query-user-bubble">{query}</div>
        {status==='thinking'?<Thinking/>:experience==='visual'?<VisualAnswer query={query}/>:experience==='route'?<>
          {conversation?.kind==='route-followup'&&<article className="chat-answer"><h2>继续同一条路线</h2><p>{linkedRouteIntro(getRoute(routeId)?.title??query,followupOrdinal)}</p></article>}
          {conversation?.kind!=='route-followup'&&<ChatRoutePanel conversationId={conversationId} query={query} existingRouteId={routeId||undefined} onRouteReady={setRouteId}/>}
        </>:<OrdinaryAnswerUnavailable/>}
      </div></section>
      {experience!=='route'&&<div className="query-chat-composer"><Composer compact value={value} onChange={setValue} mode="" onMode={()=>undefined} onSend={followUp} showScope={false} showReference={false}/></div>}
    </main>
  </ProductWorkspace>
}
