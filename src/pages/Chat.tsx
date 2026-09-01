import { useEffect, useMemo, useState } from 'react'
import { Composer } from '../components/Composer'
import { ProductWorkspace } from '../components/Shell'
import { Icon } from '../icons'
import { AgentStatus } from '../components/AgentStatus'
import { clearActiveHistory, CHAT_LAUNCH_KEY, HISTORY_OPEN_EVENT } from '../history'
import { MarkdownMath } from '../lib/MarkdownMath'
import { VisualChart } from '../visuals/VisualChart'
import { buildVisualFrames } from '../visuals/specs'
import type { VisualSpec } from '../visuals/types'
import { defaultAnswerMock, linkedRouteIntro } from '../workspace/catalog'
import { openRoute, setActiveConversation } from '../workspace/nav'
import {
  createHomeConversation,
  createMineRouteFromChat,
  getConversation,
  getRoute,
  saveConversation,
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

function DefaultAnswer({query}:{query:string}) {
  const mock=defaultAnswerMock(query)
  return <article className="chat-answer">
    <h2>{mock.heading}</h2>
    <MarkdownMath source={mock.lead}/>
    <div className="answer-sections">
      {mock.sections.map(([title,text])=><section key={title}><h3>{title}</h3><MarkdownMath source={text}/></section>)}
    </div>
    <p className="chat-answer-note">这是前端 Mock 回答；接入后端后，正文会由实时检索与模型结果替换。</p>
  </article>
}

const routeQuestions=[
  {title:'这条路线最终要把你带到哪里？',hint:'先确定达标状态，系统才能裁掉与你无关的内容。',choices:['建立直觉，能解释核心概念','完成一个可以运行的项目','应对课程、考试或面试','形成可以长期复用的知识脉络']},
  {title:'你希望按什么节奏完成？',hint:'时间约束会改变材料选择，但不会伪造不存在的捷径。',choices:['每周 3–5 小时，稳步推进','每周 8–10 小时，集中完成','先给完整路线，再由我自行安排','先完成核心主线，再逐步补齐分支']},
]

const optionLetters=['A','B','C','D']

function RouteQuestionCard({index,answer,active,onChoose}:{index:number;answer?:string;active:boolean;onChoose:(answer:string)=>void}) {
  const question=routeQuestions[index]
  return <section className={`clarification-card${answer?' is-answered':''}`} data-question={index+1}>
    <small>第 {index+1} 题 · 共 2 题</small>
    <h2>{question.title}</h2>
    <p>{question.hint}</p>
    <div className="clarification-options">{question.choices.map((choice,choiceIndex)=><button key={choice} disabled={!active} className={answer===choice?'is-selected':''} onClick={()=>onChoose(choice)}><span className="option-letter">{optionLetters[choiceIndex]}</span><strong>{choice}</strong>{answer===choice&&<Icon name="check" size={17}/>}</button>)}</div>
  </section>
}

function RouteAgentStatus({step}:{step:-2|-1|1|3}) {
  const statuses=step===-2?[
    {label:'正在理解你的学习目标...',detail:'识别主题、达标状态与需要补充的关键条件',done:false},
  ]:step===-1?[
    {label:'正在理解你的学习目标...',done:true},
    {label:'正在准备澄清问题...',detail:'把缺少的信息整理为最少的选择题',done:false},
  ]:step===1?[
    {label:'正在理解你的学习目标...',done:true},
    {label:'正在准备澄清问题...',done:true},
    {label:'正在准备下一道选择题...',detail:'根据你的第一项选择收敛路线边界',done:false},
  ]:[
    {label:'正在理解你的学习目标...',done:true},
    {label:'正在准备澄清问题...',done:true},
    {label:'正在收敛路线条件...',done:true},
    {label:'正在生成个性化学习路径...',detail:'组合载体、最终概念与先后关系',done:false},
  ]
  return <AgentStatus items={statuses}/>
}

function RouteClarification({conversationId,query,initialStep,initialChoices,routeId,onRouteReady}:{conversationId:string;query:string;initialStep:number;initialChoices:string[];routeId?:string;onRouteReady:(routeId:string)=>void}) {
  const [step,setStep]=useState(-2)
  useEffect(()=>{if(initialStep!==-2)setStep(initialStep)},[initialStep])
  const [choices,setChoices]=useState<string[]>(initialChoices)
  const [readyRouteId,setReadyRouteId]=useState(routeId??'')
  useEffect(()=>{
    saveConversation(conversationId,{routeStep:step,routeChoices:choices,routeReady:step===4,routeId:readyRouteId||undefined})
  },[choices,conversationId,readyRouteId,step])
  useEffect(()=>{
    if(initialStep===4&&step!==4){setStep(4);return}
    if(step===4){
      if(!readyRouteId){
        const route=createMineRouteFromChat(query,choices,conversationId)
        setReadyRouteId(route.id)
        onRouteReady(route.id)
      }
      return
    }
    if(step===-2){const timer=window.setTimeout(()=>setStep(-1),1400);return()=>window.clearTimeout(timer)}
    if(step===-1){const timer=window.setTimeout(()=>setStep(0),1400);return()=>window.clearTimeout(timer)}
    if(step!==1&&step!==3)return
    const timer=window.setTimeout(()=>setStep(step===1?2:4),2200)
    return()=>window.clearTimeout(timer)
  },[choices,conversationId,onRouteReady,query,readyRouteId,step])
  const choose=(answer:string)=>{setChoices((old)=>[...old,answer]);setStep(step===0?1:3)}
  const route=readyRouteId?getRoute(readyRouteId):undefined
  return <article className="route-clarification">
    {(step===-2||step===-1)&&<RouteAgentStatus step={step as -2|-1}/>}
    {step>=0&&<RouteQuestionCard index={0} answer={choices[0]} active={step===0} onChoose={choose}/>}
    {step>=1&&<div className="route-choice-summary">你的选择：{choices[0]}</div>}
    {step===1&&<RouteAgentStatus step={1}/>}
    {step>=2&&<><p className="route-followup-copy">明白了。为了让路线的载体数量和学习节奏更准确，还需要确认最后一个条件：</p><RouteQuestionCard index={1} answer={choices[1]} active={step===2} onChoose={choose}/></>}
    {step>=3&&<div className="route-choice-summary">你的选择：{choices[1]}</div>}
    {step===3&&<RouteAgentStatus step={3}/>}
    {step===4&&<section className="route-ready-card"><span><Icon name="check" size={20}/></span><div><small>路线已生成</small><h2>{route?.title??'从这里直接出发'}</h2><p>{route?`已根据“${choices[0]}”和“${choices[1]}”生成「${route.title}」。路线已写入我的路线；知识脉络会在你第一次进入学习、并看到首段讲解时同步生成。`:`已根据“${choices[0]}”和“${choices[1]}”生成一条 Mock 路线；下一步直接进入 3D 路线视图。`}</p><button onClick={()=>{openRoute(readyRouteId,'chat');location.hash='path-3d'}}>进入学习路线 <Icon name="arrow-right" size={16}/></button></div></section>}
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
  const [status,setStatus]=useState<'thinking'|'complete'>(stored?.routeReady||launch.mode==='route'?'complete':'thinking')
  const [value,setValue]=useState('')
  useEffect(()=>{if(conversationId)setActiveConversation(conversationId)},[conversationId])
  useEffect(()=>{
    if(experience==='route'){setStatus('complete');return}
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
  const routeReady=conversation?.routeReady||conversation?.kind==='route-followup'||Boolean(routeId&&experience==='route'&&(conversation?.routeStep??-2)===4)
  const followupOrdinal=routeId?1+(conversation?.title.match(/对话 (\d+)/)?.[1]?Number(conversation.title.match(/对话 (\d+)/)?.[1])-1:0):1
  return <ProductWorkspace active="paths" page="chat">
    <main className="query-chat">
      <header className="query-chat-header"><div><button aria-label="返回首页" onClick={()=>location.hash='home'}><Icon name="back" size={18}/></button><h1>{query}</h1></div><button className="new-chat-only" onClick={newChat}><Icon name="new-chat" size={17}/>新对话</button></header>
      <section className="query-chat-body"><div className="query-chat-flow">
        <div className="query-user-bubble">{query}</div>
        {status==='thinking'?<Thinking/>:experience==='visual'?<VisualAnswer query={query}/>:experience==='route'?<>
          {conversation?.kind==='route-followup'&&<article className="chat-answer"><h2>继续同一条路线</h2><p>{linkedRouteIntro(getRoute(routeId)?.title??query,followupOrdinal)}</p></article>}
          <RouteClarification conversationId={conversationId} query={query} initialStep={routeReady?4:conversation?.routeStep??-2} initialChoices={conversation?.routeChoices??[]} routeId={routeId||undefined} onRouteReady={setRouteId}/>
        </>:<DefaultAnswer query={query}/>}
      </div></section>
      {experience!=='route'&&<div className="query-chat-composer"><Composer compact value={value} onChange={setValue} mode="" onMode={()=>undefined} onSend={followUp} showScope={false} showReference={false}/></div>}
    </main>
  </ProductWorkspace>
}
