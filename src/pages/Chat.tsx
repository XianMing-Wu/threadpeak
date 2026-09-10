import { useEffect,useRef,useState } from 'react'
import { resolveChatLaunch,type ChatLaunchReady } from '../chat/resolve-chat-launch'
import { Composer } from '../components/Composer'
import { ProductWorkspace } from '../components/Shell'
import { CHAT_LAUNCH_KEY,clearActiveHistory,HISTORY_OPEN_EVENT } from '../history'
import { Icon } from '../icons'
import { OrdinaryChat } from '../learning-v2/OrdinaryChat'
import { ChatRoutePanel } from '../path-planning/chat-route-panel'
import { readLearningThinking,subscribeLearningThinking,writeLearningThinking } from '../session/learning-thinking'
import { setActiveConversation } from '../workspace/nav'
import {
getConversation
} from '../workspace/store'
import { NotFoundPage } from './NotFound'

export type ChatExperience = 'answer' | 'route'

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

function fieldsFromLaunch(next: ChatLaunchReady) {
  const conversation=next.conversationId?getConversation(next.conversationId):undefined
  return {
    query: conversation?.query ?? next.query,
    experience: experienceOf(conversation?.experience, next.mode),
    conversationId: conversation?.id ?? next.conversationId,
    routeId: conversation?.routeId ?? next.routeId ?? '',
    generate: next.generate === true,
    turns: conversation?.turns ?? [],
    thinkingDepth: next.thinkingDepth === 'deep' || next.thinkingDepth === 'fast' ? next.thinkingDepth : readLearningThinking(),
  }
}

export function ChatPage() {
  const [launch,setLaunch]=useState(()=>resolveChatLaunch(readChatLaunchPayload()))
  const initial=launch.kind==='ready'?fieldsFromLaunch(launch):null
  const [query,setQuery]=useState(initial?.query??'')
  const [experience,setExperience]=useState<ChatExperience>(initial?.experience??'answer')
  const [conversationId,setConversationId]=useState(initial?.conversationId??'')
  const [routeId,setRouteId]=useState(initial?.routeId??'')
  const [generate,setGenerate]=useState(initial?.generate??false)
  const [value,setValue]=useState('')
  const [thinkingDepth,setThinkingDepth]=useState<'fast' | 'deep'>(initial?.thinkingDepth ?? readLearningThinking())
  const [generating,setGenerating]=useState(false)
  const routeSender=useRef<(text:string)=>Promise<boolean>>(async()=>false)
  const stopGeneration=useRef<() => void>(() => undefined)
  useEffect(() => subscribeLearningThinking(() => setThinkingDepth(readLearningThinking())), [])
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
      setGenerate(fields.generate)
      setThinkingDepth(fields.thinkingDepth)
      setValue('')
    }
    addEventListener(HISTORY_OPEN_EVENT,restore)
    return()=>removeEventListener(HISTORY_OPEN_EVENT,restore)
  },[])
  if(launch.kind!=='ready')return <NotFoundPage/>
  if(experience==='answer')return <OrdinaryChat key={conversationId} chatId={conversationId} question={query} resourceId={launch.resourceId} initialDepth={thinkingDepth}/>
  const followUp=()=>{
    const next=value.trim()
    if(!next)return
    void routeSender.current(next).then(ok=>{if(ok)setValue(current=>current.trim()===next?'':current)})
  }
  const newChat=()=>{
    sessionStorage.removeItem(CHAT_LAUNCH_KEY)
    clearActiveHistory()
    location.hash='home'
  }
  return <ProductWorkspace active="paths" page="chat">
    <main className="query-chat">
      <header className="query-chat-header"><div><button aria-label="返回首页" onClick={()=>location.hash='home'}><Icon name="back" size={18}/></button><h1>{query}</h1></div><button className="new-chat-only" onClick={newChat}><Icon name="new-chat" size={17}/>新对话</button></header>
      <section className="query-chat-body"><div className="query-chat-flow">
        <ChatRoutePanel key={conversationId} conversationId={conversationId} generate={generate} resourceId={launch.resourceId} query={query} existingRouteId={routeId||undefined} thinkingDepth={thinkingDepth} onRouteReady={setRouteId} onSender={(handler)=>{routeSender.current=handler}} onGenerating={setGenerating} onStopRef={(stop)=>{stopGeneration.current=stop}}/>
      </div></section>
      <div className="query-chat-composer">
        <Composer compact value={value} onChange={setValue} onSend={followUp} showAttachment={false} thinkingDepth={thinkingDepth} onThinkingDepth={(next) => { writeLearningThinking(next); setThinkingDepth(next) }} busy={generating} onStop={() => { stopGeneration.current() }}/>
      </div>
    </main>
  </ProductWorkspace>
}
