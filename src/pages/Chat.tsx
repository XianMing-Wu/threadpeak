import { useEffect, useRef, useState } from 'react'
import { Composer } from '../components/Composer'
import { ProductWorkspace } from '../components/Shell'
import { Icon } from '../icons'
import { clearActiveHistory, CHAT_LAUNCH_KEY, HISTORY_OPEN_EVENT } from '../history'
import { resolveChatLaunch, type ChatLaunchReady } from '../chat/resolve-chat-launch'
import { buildOrdinaryChatContext } from '../chat/build-ordinary-chat-context'
import { requestOrdinaryAnswerStream } from '../chat/request-ordinary-answer'
import { resolveOrdinaryAnswer } from '../chat/resolve-ordinary-answer'
import { MarkdownMath } from '../lib/MarkdownMath'
import { linkedRouteIntro } from '../workspace/catalog'
import { setActiveConversation } from '../workspace/nav'
import { EmptyStatus } from '../components/EmptyStatus'
import { StatusOrbChip } from '../components/StatusOrb'
import { ChatRoutePanel } from '../path-planning/chat-route-panel'
import { pathLaunchAttachments, type PathAttachment } from '../path-planning/path-run-client'
import { NotFoundPage } from './NotFound'
import {
  createHomeConversation,
  getConversation,
  getRoute,
  saveConversation,
  startLinkedConversation,
} from '../workspace/store'
import type { LearningTurn } from '../workspace/types'

export type ChatExperience = 'answer' | 'route'

export function launchChat(query:string,mode:ChatExperience,attachments: PathAttachment[] = []) {
  const conversation=createHomeConversation(query,mode)
  if (attachments.length > 0) pathLaunchAttachments.set(conversation.id, attachments)
  sessionStorage.setItem(CHAT_LAUNCH_KEY,JSON.stringify({query,mode,conversationId:conversation.id,routeId:conversation.routeId,generate:true}))
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
  return value === 'route' || value === 'answer' ? value : fallback
}

function OrdinaryAnswerUnavailable() {
  const resolution=resolveOrdinaryAnswer()
  return <article className="chat-answer" role="alert">
    <EmptyStatus kind="error" density="inline" title={resolution.title} body={resolution.message} />
  </article>
}

function OrdinaryAnswerLive({
  query,
  turns,
  attachments,
  thinkingDepth,
  onSettled,
}: {
  query: string
  turns: LearningTurn[]
  attachments: PathAttachment[]
  thinkingDepth: 'fast' | 'deep'
  onSettled?: (text: string) => void
}) {
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const settled = useRef(onSettled)
  settled.current = onSettled
  useEffect(() => {
    let cancelled = false
    setText(null)
    setError(null)
    const context = buildOrdinaryChatContext({
      currentMessage: query,
      turns: turns.map((turn) => ({ role: turn.role, text: turn.text })),
      attachments,
    })
    void requestOrdinaryAnswerStream({
      currentMessage: context.currentMessage,
      conversation: context.conversation,
      attachments: context.attachments,
      thinkingDepth,
      onDelta: (next) => {
        if (cancelled) return
        setText(next)
      },
    }).then((result) => {
      if (cancelled) return
      if (result.kind === 'completed') {
        setText(result.text)
        settled.current?.(result.text)
        return
      }
      setError(result.message)
    })
    return () => { cancelled = true }
  }, [query])
  if (!query.trim()) return <OrdinaryAnswerUnavailable/>
  if (error) return <article className="chat-answer" role="alert"><EmptyStatus kind="error" density="inline" title="无法生成本次回答" body={error} /></article>
  if (!text) return <article className="chat-answer" aria-live="polite"><StatusOrbChip label="正在生成本次回答"/></article>
  return <article className="chat-answer" aria-live="polite"><MarkdownMath source={text}/></article>
}

function fieldsFromLaunch(next: ChatLaunchReady) {
  const conversation=next.conversationId?getConversation(next.conversationId):undefined
  return {
    query: conversation?.query ?? next.query,
    experience: experienceOf(conversation?.experience, next.mode),
    conversationId: conversation?.id ?? next.conversationId,
    routeId: conversation?.routeId ?? next.routeId ?? '',
    generate: next.generate === true,
    turns: conversation?.turns ?? [],
  }
}

function writeTurns(conversationId: string, turns: LearningTurn[]) {
  if (!conversationId) return
  saveConversation(conversationId, { turns })
}

export function ChatPage() {
  const [launch,setLaunch]=useState(()=>resolveChatLaunch(readChatLaunchPayload()))
  const initial=launch.kind==='ready'?fieldsFromLaunch(launch):null
  const [query,setQuery]=useState(initial?.query??'')
  const [experience,setExperience]=useState<ChatExperience>(initial?.experience??'answer')
  const [conversationId,setConversationId]=useState(initial?.conversationId??'')
  const [routeId,setRouteId]=useState(initial?.routeId??'')
  const [value,setValue]=useState('')
  const [thinkingDepth,setThinkingDepth]=useState<'fast' | 'deep'>('fast')
  const [turns,setTurns]=useState<LearningTurn[]>(initial?.turns ?? [])
  const [pendingQuestion,setPendingQuestion]=useState(initial?.generate && initial.experience === 'answer' && !(initial.turns.length) ? initial.query : '')
  const routeSender=useRef<(text:string)=>void>(()=>undefined)
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
        setTurns([])
        setPendingQuestion('')
        return
      }
      const fields=fieldsFromLaunch(next)
      setQuery(fields.query)
      setExperience(fields.experience)
      setConversationId(fields.conversationId)
      setRouteId(fields.routeId)
      setTurns(fields.turns)
      setPendingQuestion(fields.generate && fields.experience === 'answer' && fields.turns.length === 0 ? fields.query : '')
      setValue('')
    }
    addEventListener(HISTORY_OPEN_EVENT,restore)
    return()=>removeEventListener(HISTORY_OPEN_EVENT,restore)
  },[])
  if(launch.kind!=='ready')return <NotFoundPage/>
  const followUp=()=>{
    const next=value.trim()
    if(!next)return
    if(experience==='route'){
      routeSender.current(next)
      setValue('')
      return
    }
    setTurns((current) => {
      const following = [...current, { role: 'user' as const, text: next }]
      writeTurns(conversationId, following)
      return following
    })
    setPendingQuestion(next)
    setValue('')
  }
  const settleAnswer = (text: string) => {
    setTurns((current) => {
      const following = [...current]
      if (following.at(-1)?.role !== 'user') following.push({ role: 'user', text: pendingQuestion || query })
      following.push({ role: 'assistant', text })
      writeTurns(conversationId, following)
      return following
    })
    setPendingQuestion('')
  }
  const newChat=()=>{
    if(routeId){
      const linked=startLinkedConversation(routeId)
      sessionStorage.setItem(CHAT_LAUNCH_KEY,JSON.stringify({query:linked.query,mode:'route',conversationId:linked.id,routeId}))
      setConversationId(linked.id)
      setQuery(linked.query)
      setExperience('route')
      setTurns([])
      setPendingQuestion('')
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
        {experience==='route'?<>
          {conversation?.kind==='route-followup'&&<article className="chat-answer"><h2>继续同一条路线</h2><p>{linkedRouteIntro(getRoute(routeId)?.title??query,followupOrdinal)}</p></article>}
          {conversation?.kind!=='route-followup'&&<ChatRoutePanel conversationId={conversationId} query={query} existingRouteId={routeId||undefined} thinkingDepth={thinkingDepth} onRouteReady={setRouteId} onSender={(handler)=>{routeSender.current=handler}}/>}
        </>:<>
          {(turns.length ? turns : pendingQuestion ? [{ role: 'user' as const, text: pendingQuestion }] : [{ role: 'user' as const, text: query }]).map((turn, index) => (
            turn.role === 'user'
              ? <div className="query-user-bubble" key={`u-${index}`}>{turn.text}</div>
              : <article className="chat-answer" key={`a-${index}`}><MarkdownMath source={turn.text}/></article>
          ))}
          {pendingQuestion ? <OrdinaryAnswerLive query={pendingQuestion} turns={turns} attachments={pathLaunchAttachments.get(conversationId) ?? []} thinkingDepth={thinkingDepth} onSettled={settleAnswer}/> : null}
        </>}
      </div></section>
      <div className="query-chat-composer">
        <Composer compact value={value} onChange={setValue} onSend={followUp} showAttachment={false} thinkingDepth={thinkingDepth} onThinkingDepth={setThinkingDepth}/>
      </div>
    </main>
  </ProductWorkspace>
}
