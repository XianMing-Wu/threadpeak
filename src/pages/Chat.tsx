import { useEffect, useState } from 'react'
import { Composer } from '../components/Composer'
import { ProductWorkspace } from '../components/Shell'
import { Icon } from '../icons'
import { clearActiveHistory, CHAT_LAUNCH_KEY, HISTORY_OPEN_EVENT } from '../history'
import { resolveChatLaunch, type ChatLaunchReady } from '../chat/resolve-chat-launch'
import { requestOrdinaryAnswer } from '../chat/request-ordinary-answer'
import { resolveOrdinaryAnswer } from '../chat/resolve-ordinary-answer'
import { MarkdownMath } from '../lib/MarkdownMath'
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

function readChatLaunchPayload(): unknown {
  try {
    return JSON.parse(sessionStorage.getItem(CHAT_LAUNCH_KEY) ?? 'null')
  } catch {
    return null
  }
}

function experienceOf(value: unknown, fallback: ChatExperience): ChatExperience {
  return value === 'route' || value === 'visual' || value === 'answer' ? value : fallback
}

function OrdinaryAnswerUnavailable() {
  const resolution=resolveOrdinaryAnswer()
  return <article className="chat-answer" role="alert">
    <h2>{resolution.title}</h2>
    <p>{resolution.message}</p>
  </article>
}

function OrdinaryAnswerLive({ query }: { query: string }) {
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    setText(null)
    setError(null)
    void requestOrdinaryAnswer({ question: query }).then((result) => {
      if (cancelled) return
      if (result.kind === 'completed') setText(result.text)
      else setError(result.message)
    })
    return () => { cancelled = true }
  }, [query])
  if (!query.trim()) return <OrdinaryAnswerUnavailable/>
  if (error) return <article className="chat-answer" role="alert"><h2>无法生成本次回答</h2><p>{error}</p></article>
  if (!text) return <article className="chat-answer" aria-live="polite"><h2>正在检索公开证据并生成回答</h2><p>这次请求会走服务端知乎检索和 DeepSeek。没有真实配置时会显式失败。</p></article>
  return <article className="chat-answer"><MarkdownMath source={text}/></article>
}

function VisualAnswerUnavailable() {
  const resolution=resolveVisualAnswer()
  return <article className="chat-answer" role="alert">
    <h2>{resolution.title}</h2>
    <p>{resolution.message}</p>
  </article>
}

function ChatLaunchUnavailable({ title, message }: { title: string; message: string }) {
  return <ProductWorkspace active="paths" page="chat">
    <main className="query-chat">
      <header className="query-chat-header">
        <div>
          <button aria-label="返回首页" onClick={()=>location.hash='home'}><Icon name="back" size={18}/></button>
          <h1>{title}</h1>
        </div>
      </header>
      <section className="query-chat-body">
        <article className="chat-answer" role="alert">
          <h2>{title}</h2>
          <p>{message}</p>
        </article>
      </section>
    </main>
  </ProductWorkspace>
}

function fieldsFromLaunch(next: ChatLaunchReady) {
  const conversation=next.conversationId?getConversation(next.conversationId):undefined
  return {
    query: conversation?.query ?? next.query,
    experience: experienceOf(conversation?.experience, next.mode),
    conversationId: conversation?.id ?? next.conversationId,
    routeId: conversation?.routeId ?? next.routeId ?? '',
  }
}

export function ChatPage() {
  const [launch,setLaunch]=useState(()=>resolveChatLaunch(readChatLaunchPayload()))
  const initial=launch.kind==='ready'?fieldsFromLaunch(launch):null
  const [query,setQuery]=useState(initial?.query??'')
  const [experience,setExperience]=useState<ChatExperience>(initial?.experience??'answer')
  const [conversationId,setConversationId]=useState(initial?.conversationId??'')
  const [routeId,setRouteId]=useState(initial?.routeId??'')
  const [value,setValue]=useState('')
  useEffect(()=>{if(conversationId)setActiveConversation(conversationId)},[conversationId])
  useEffect(()=>{
    const restore=()=>{
      const next=resolveChatLaunch(readChatLaunchPayload())
      setLaunch(next)
      if(next.kind!=='ready'){
        setQuery('')
        setConversationId('')
        setRouteId('')
        setValue('')
        return
      }
      const fields=fieldsFromLaunch(next)
      setQuery(fields.query)
      setExperience(fields.experience)
      setConversationId(fields.conversationId)
      setRouteId(fields.routeId)
      setValue('')
    }
    addEventListener(HISTORY_OPEN_EVENT,restore)
    return()=>removeEventListener(HISTORY_OPEN_EVENT,restore)
  },[])
  if(launch.kind==='unavailable')return <ChatLaunchUnavailable title={launch.title} message={launch.message}/>
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
        </>:<OrdinaryAnswerLive query={query}/>}
      </div></section>
      {experience!=='route'&&<div className="query-chat-composer"><Composer compact value={value} onChange={setValue} mode="" onMode={()=>undefined} onSend={followUp} showScope={false} showReference={false}/></div>}
    </main>
  </ProductWorkspace>
}
