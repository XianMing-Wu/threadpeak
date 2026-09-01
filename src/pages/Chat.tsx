import { useEffect, useMemo, useState } from 'react'
import { Composer } from '../components/Composer'
import { ProductWorkspace } from '../components/Shell'
import { Icon } from '../icons'
import { clearActiveHistory, CHAT_LAUNCH_KEY, HISTORY_OPEN_EVENT } from '../history'
import { resolveOrdinaryAnswer } from '../chat/resolve-ordinary-answer'
import { resolveVisualAnswer } from '../chat/resolve-visual-answer'
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

function OrdinaryAnswerUnavailable() {
  const resolution=resolveOrdinaryAnswer()
  return <article className="chat-answer" role="alert">
    <h2>{resolution.title}</h2>
    <p>{resolution.message}</p>
  </article>
}

function VisualAnswerUnavailable() {
  const resolution=resolveVisualAnswer()
  return <article className="chat-answer" role="alert">
    <h2>{resolution.title}</h2>
    <p>{resolution.message}</p>
  </article>
}

export function ChatPage() {
  const launch=useMemo(readLaunch,[])
  const stored=launch.conversationId?getConversation(launch.conversationId):undefined
  const [query,setQuery]=useState(stored?.query??launch.query)
  const [experience,setExperience]=useState<ChatExperience>(stored?.experience??launch.mode)
  const [conversationId,setConversationId]=useState(stored?.id??launch.conversationId)
  const [routeId,setRouteId]=useState(stored?.routeId??launch.routeId??'')
  const [value,setValue]=useState('')
  useEffect(()=>{if(conversationId)setActiveConversation(conversationId)},[conversationId])
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
        {experience==='visual'?<VisualAnswerUnavailable/>:experience==='route'?<>
          {conversation?.kind==='route-followup'&&<article className="chat-answer"><h2>继续同一条路线</h2><p>{linkedRouteIntro(getRoute(routeId)?.title??query,followupOrdinal)}</p></article>}
          {conversation?.kind!=='route-followup'&&<ChatRoutePanel conversationId={conversationId} query={query} existingRouteId={routeId||undefined} onRouteReady={setRouteId}/>}
        </>:<OrdinaryAnswerUnavailable/>}
      </div></section>
      {experience!=='route'&&<div className="query-chat-composer"><Composer compact value={value} onChange={setValue} mode="" onMode={()=>undefined} onSend={followUp} showScope={false} showReference={false}/></div>}
    </main>
  </ProductWorkspace>
}
