import { useEffect, useRef, useState } from 'react'
import { AnnotatedText } from '../components/AnnotatedText'
import { AnnotationPanel } from '../components/AnnotationPanel'
import { AskAuthorsPrompt } from '../components/AskAuthorsPrompt'
import { BasisVisual } from '../components/BasisVisual'
import type { AssistantMode } from '../assistant-mode'
import { Composer } from '../components/Composer'
import { SelectionToolbar } from '../components/SelectionToolbar'
import { ProductWorkspace } from '../components/Shell'
import { AgentStatus } from '../components/AgentStatus'
import { Icon } from '../icons'
import { HISTORY_OPEN_EVENT } from '../history'
import { openKnowledgeCanvas } from '../learningSession'
import { readSelectionAnchor, type SelectionAnchor } from '../session/ask-authors'
import { useAnnotations } from '../session/useAnnotations'
import { parseGrowCommand } from '../knowledge-canvas/generate'
import { MarkdownMath } from '../lib/MarkdownMath'
import { VisualAnswer } from './Chat'
import { coachReply, conceptTitle } from '../workspace/catalog'
import {
  readActiveConceptId,
  readActiveConversationId,
  readActiveRouteId,
  readSessionReturn,
  setActiveConversation,
} from '../workspace/nav'
import {
  blueprintOf,
  ensureLearningConversation,
  appendLearningTurnToGraph,
  getConversation,
  getKnowledgeByRoute,
  getLesson,
  hasGeneratedLesson,
  saveConversationDraft,
  startLearningConversation,
  syncConversationGraph,
  syncKnowledgeWithFirstLesson,
} from '../workspace/store'
import type { LearningTurn } from '../workspace/types'

let sessionStatusTitle = '线性变换'

function resolveLearningConversation(routeId: string, conceptId: string) {
  const active = getConversation(readActiveConversationId())
  if (active?.kind === 'learning' && active.routeId === routeId && active.conceptId === conceptId) return active
  return ensureLearningConversation(routeId, conceptId)
}

export function SessionPage() {
  const selectRootRef = useRef<HTMLDivElement>(null)
  const routeId = readActiveRouteId() || 'linear-algebra'
  const conceptId = readActiveConceptId() || 'linear-map'
  const blueprint = blueprintOf(routeId)
  const title = conceptTitle(blueprint, conceptId) || '线性变换'
  const alreadyReady = hasGeneratedLesson(routeId, conceptId)
  const [entryPhase,setEntryPhase] = useState<'preparing'|'ready'>('preparing')
  const conversationRef = useRef(resolveLearningConversation(routeId, conceptId))
  const seed = getConversation(conversationRef.current.id)
  const [quote,setQuote] = useState(seed?.quote ?? '')
  const [quoteFromId,setQuoteFromId] = useState('')
  const [selection,setSelection] = useState<SelectionAnchor|null>(null)
  const [authorQuestion,setAuthorQuestion] = useState<SelectionAnchor|null>(null)
  const annotations = useAnnotations(`${routeId}::${conceptId}`)
  const [mode,setMode] = useState<AssistantMode>(seed?.mode ?? '')
  const [value,setValue] = useState(seed?.value ?? '')
  const [turns,setTurns] = useState<LearningTurn[]>(seed?.turns ?? [])
  const [lesson,setLesson] = useState(() => getLesson(routeId, conceptId) ?? {
    heading: title,
    paragraphs: [],
    placeholder: `围绕“${title}”继续提问，或选择上方模式深入理解…`,
  })

  useEffect(() => {
    setActiveConversation(conversationRef.current.id)
  }, [])

  useEffect(() => {
    const restore = () => {
      const nextRoute = readActiveRouteId() || 'linear-algebra'
      const nextConcept = readActiveConceptId() || 'linear-map'
      const next = resolveLearningConversation(nextRoute, nextConcept)
      conversationRef.current = next
      setActiveConversation(next.id)
      setTurns(next.turns ?? [])
      setValue(next.value ?? '')
      setQuote(next.quote ?? '')
      setMode(next.mode ?? '')
      setSelection(null)
      setAuthorQuestion(null)
      setLesson(getLesson(nextRoute, nextConcept) ?? {
        heading: conceptTitle(blueprintOf(nextRoute), nextConcept) || nextConcept,
        paragraphs: [],
        placeholder: `围绕“${conceptTitle(blueprintOf(nextRoute), nextConcept) || nextConcept}”继续提问，或选择上方模式深入理解…`,
      })
    }
    addEventListener(HISTORY_OPEN_EVENT, restore)
    return () => removeEventListener(HISTORY_OPEN_EVENT, restore)
  }, [])

  useEffect(() => {
    if (alreadyReady) {
      setEntryPhase('ready')
      return
    }
    setEntryPhase('preparing')
    const generate=window.setTimeout(()=>{
      setLesson(syncKnowledgeWithFirstLesson(routeId, conceptId).lesson)
    },1800)
    const timer=window.setTimeout(()=>setEntryPhase('ready'),1800)
    return()=>{window.clearTimeout(generate);window.clearTimeout(timer)}
  },[alreadyReady,conceptId,routeId])

  useEffect(() => {
    const clear=(event:MouseEvent)=>{
      const target=event.target as Element|null
      if(target?.closest('.sel-toolbar,.ask-authors-prompt,.annotation-panel,.annotation-panel-reopen,.annotation-ball')) return
      setSelection(null)
    }
    document.addEventListener('mousedown',clear)
    return()=>document.removeEventListener('mousedown',clear)
  },[])

  useEffect(() => {
    saveConversationDraft(conversationRef.current.id, { turns, value, quote, mode })
  }, [mode, quote, turns, value])

  const detect = (text:string):AssistantMode => /图|可视化|思维导图|时间线/.test(text)?'visual':/博主|作者|谁.*说/.test(text)?'authors':''
  const resetBranch = () => {
    const next = startLearningConversation(routeId, conceptId)
    conversationRef.current = next
    setActiveConversation(next.id)
    syncConversationGraph(routeId, conceptId, next.id, [])
    setTurns([])
    setValue('')
    setQuote('')
    setQuoteFromId('')
    setMode('')
    setSelection(null)
    setAuthorQuestion(null)
  }
  const send = () => {
    const chosen=mode||detect(value)
    if(!value.trim()&&!quote)return
    const asked=value
    const cited=quote
    const fromId=cited?quoteFromId:''
    const grow=parseGrowCommand(asked)?.kind
    const userText=cited?`引用「${cited}」\n${asked}`:asked
    const assistantText=chosen==='authors'?'authors':chosen==='visual'?'visual':coachReply(title, cited || asked.replace(/^[123]\s*/, '').trim() || title)
    const createdId=appendLearningTurnToGraph(routeId, conceptId, conversationRef.current.id, {
      question: asked,
      quote: cited,
      quoteFromId: fromId,
      reply: assistantText,
    })
    setTurns((old)=>[...old,{role:'user',text:userText,mode:chosen,quote:cited,quoteFromId:fromId,grow},{role:'assistant',text:assistantText,mode:chosen,nodeId:createdId}])
    setValue(''); setQuote(''); setQuoteFromId(''); setMode('')
  }
  const onSelect = () => {
    if (authorQuestion) return
    const node = window.getSelection()?.anchorNode
    const el = node instanceof Element ? node : node?.parentElement
    if (el?.closest('.user-turn')) {
      setSelection(null)
      return
    }
    setSelection(readSelectionAnchor(selectRootRef.current, (node) => {
      const el = node instanceof Element ? node : node.parentElement
      return el?.closest('[data-canvas-host]')?.getAttribute('data-canvas-host') || 'root'
    }))
  }
  const addToChat = () => {
    if (!selection) return
    setQuote(selection.text)
    setQuoteFromId(selection.nodeId || 'root')
    setSelection(null)
    window.getSelection()?.removeAllRanges()
  }
  const openAskAuthors = () => {
    if (!selection) return
    setAuthorQuestion(selection)
    setSelection(null)
    window.getSelection()?.removeAllRanges()
  }
  const submitAskAuthors = (question: string) => {
    if (!authorQuestion) return
    annotations.create(authorQuestion.text, question, authorQuestion.nodeId || 'root')
    setAuthorQuestion(null)
  }
  const knowledgeReady = Boolean(getKnowledgeByRoute(routeId))
  const placeholder = lesson.placeholder || `围绕“${title}”继续提问，或选择上方模式深入理解…`
  sessionStatusTitle = title

  return <ProductWorkspace active="paths" page="session-learning">
    <main className="learning-session">
      <section className="lesson-chat">
        <header>
          <div className="lesson-heading">
            <button type="button" className="lesson-back" aria-label="返回上一级" onClick={()=>{location.hash=readSessionReturn()}}><Icon name="back" size={18}/></button>
            <div><small>刘看山陪你学</small><h1>{title}</h1></div>
          </div>
          <div className="lesson-actions">
            {knowledgeReady && <button type="button" onClick={()=>openKnowledgeCanvas('session-learning')}><Icon name="book" size={17}/>知识脉络</button>}
            <button type="button" onClick={resetBranch}><Icon name="new-chat" size={17}/>新对话</button>
          </div>
        </header>
        <div className="conversation" ref={selectRootRef} onMouseUp={onSelect}>
          {entryPhase==='preparing'?<SessionEntryStatus/>:<>
            <article data-canvas-host="root"><span className="kanshan-avatar">山</span><div>
              <h2>{lesson.heading}</h2>
              {lesson.paragraphs.map((paragraph) => <p key={paragraph}><AnnotatedText text={paragraph} annotations={annotations.annotations} activeId={annotations.active?.id} onOpen={annotations.open}/></p>)}
              {lesson.quote && <blockquote><AnnotatedText text={lesson.quote} annotations={annotations.annotations} activeId={annotations.active?.id} onOpen={annotations.open}/></blockquote>}
              {lesson.figureCaption && <BasisVisual caption={lesson.figureCaption}/>}
            </div></article>
            {turns.map((turn,i)=>turn.role==='user'?<div className="user-turn" key={i}>{turn.text}</div>:<AssistantAnswer key={i} kind={turn.text} host={turn.nodeId || `turn:${i}`} topic={title}/>) }
          </>}
        </div>
        {entryPhase==='ready'&&<><div className="mode-prompts"><button className={mode==='visual'?'is-active':''} onClick={()=>setMode(mode==='visual'?'':'visual')}><Icon name="image" size={17}/>图文模式</button></div>
        <Composer compact value={value} onChange={setValue} mode={mode} onMode={setMode} onSend={send} quote={quote} onClearQuote={()=>{setQuote('');setQuoteFromId('')}} showScope={false} showReference={false} showAttachment={false} placeholder={placeholder}/></>}
      </section>
      {annotations.panelOpen && annotations.active && <AnnotationPanel annotation={annotations.active} onClose={annotations.close}/>}
      {!annotations.panelOpen && annotations.annotations.length > 0 && <button type="button" className="annotation-panel-reopen" aria-label="显示侧边面板" onClick={annotations.reopen}>批注</button>}
      {selection && !authorQuestion && <SelectionToolbar selection={selection} onAddToChat={addToChat} onAskAuthors={openAskAuthors}/>}
      {authorQuestion && <AskAuthorsPrompt selection={authorQuestion} onCancel={()=>setAuthorQuestion(null)} onSubmit={submitAskAuthors}/>}
    </main>
  </ProductWorkspace>
}

function SessionEntryStatus() {
  return <AgentStatus items={[{label:'正在准备当前学习内容...',detail:`正在组织“${sessionStatusTitle}”的讲解与可视化内容`}]}/>
}

function AssistantAnswer({kind,host,topic}:{kind:string;host:string;topic:string}) {
  if(kind==='authors') return <section className="assistant-turn" data-canvas-host={host}><span className="kanshan-avatar">山</span><div><p>我从博主网络里挑出了与你当前问题最相关的两位作者：</p><div className="author-answer"><b>马同学</b><p>我会先让你盯住基向量：矩阵的列不是随意排出来的数，它们就是基向量变换后的坐标。把这个动作画出来，矩阵乘法就不再抽象。</p><small>《为什么矩阵可以被理解为线性变换？》</small></div><div className="author-answer"><b>李永乐老师</b><p>我更建议从坐标系理解“基”。换一组基只是换一种描述，同一个线性变换会有不同矩阵，但空间里的动作没有变。</p><small>《如何直观理解向量空间和基？》</small></div></div></section>
  if(kind==='visual') return <section className="assistant-turn" data-canvas-host={host}><span className="kanshan-avatar">山</span><div><p>我把这段关系整理成可交互的图。文字继续往下走，每张图在自己的位置单独生成。</p><VisualAnswer query={topic}/></div></section>
  return <section className="assistant-turn" data-canvas-host={host}><span className="kanshan-avatar">山</span><div><MarkdownMath source={kind}/></div></section>
}
