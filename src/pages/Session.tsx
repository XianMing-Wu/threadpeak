import { useEffect, useRef, useState } from 'react'
import { AnnotatedText } from '../components/AnnotatedText'
import { AnnotationPanel } from '../components/AnnotationPanel'
import { AskAuthorsPrompt } from '../components/AskAuthorsPrompt'
import { BasisVisual } from '../components/BasisVisual'
import type { AssistantMode } from '../assistant-mode'
import { Composer } from '../components/Composer'
import { SelectionToolbar } from '../components/SelectionToolbar'
import { ProductWorkspace } from '../components/Shell'
import { Icon } from '../icons'
import { HISTORY_OPEN_EVENT } from '../history'
import { openKnowledgeCanvas } from '../learningSession'
import { readSelectionAnchor, type SelectionAnchor } from '../session/ask-authors'
import { useAnnotations } from '../session/useAnnotations'
import { parseGrowCommand } from '../knowledge-canvas/generate'
import { MarkdownMath } from '../lib/MarkdownMath'
import { resolveVisualAnswer } from '../chat/resolve-visual-answer'
import { resolveAskAuthor } from '../session/resolve-ask-author'
import { requestAskAuthor } from '../session/request-ask-author'
import { requestOrdinaryAnswer } from '../chat/request-ordinary-answer'
import { catalogLesson, blueprintConcepts, conceptTitle } from '../workspace/catalog'
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
  getRoute,
  saveConversationDraft,
  startLearningConversation,
  syncConversationGraph,
} from '../workspace/store'
import type { LearningTurn } from '../workspace/types'
import { resolveFirstLesson, resolveLearningEntry } from '../session/resolve-learning-entry'

function readLearningNav() {
  return { routeId: readActiveRouteId(), conceptId: readActiveConceptId() }
}

function resolveLearningConversation(routeId: string, conceptId: string) {
  const active = getConversation(readActiveConversationId())
  if (active?.kind === 'learning' && active.routeId === routeId && active.conceptId === conceptId) return active
  return ensureLearningConversation(routeId, conceptId)
}

function SessionUnavailable(props: { title: string; message: string }) {
  return <ProductWorkspace active="paths" page="session-learning">
    <main className="learning-session">
      <section className="lesson-chat">
        <header>
          <div className="lesson-heading">
            <button type="button" className="lesson-back" aria-label="返回上一级" onClick={()=>{location.hash=readSessionReturn()}}><Icon name="back" size={18}/></button>
            <div><small>刘看山陪你学</small><h1>{props.title}</h1></div>
          </div>
        </header>
        <div className="conversation" role="alert">
          <article>
            <h2>无法进入这次学习</h2>
            <p>{props.message}</p>
          </article>
        </div>
      </section>
    </main>
  </ProductWorkspace>
}

export function SessionPage() {
  const [nav, setNav] = useState(readLearningNav)
  useEffect(() => {
    const restore = () => setNav(readLearningNav())
    addEventListener(HISTORY_OPEN_EVENT, restore)
    return () => removeEventListener(HISTORY_OPEN_EVENT, restore)
  }, [])
  const route = nav.routeId ? getRoute(nav.routeId) : undefined
  const conceptIds = route
    ? [...new Set([
      ...blueprintConcepts(blueprintOf(route.id)).map((item) => item.id),
      ...route.document.structure.concepts.map((item) => item.id),
    ])]
    : []
  const entry = resolveLearningEntry({
    routeId: nav.routeId,
    conceptId: nav.conceptId,
    conceptIds,
    ...(route ? { route } : {}),
  })
  if (entry.kind === 'unavailable') return <SessionUnavailable title={entry.title} message={entry.message}/>
  if (!route) return <SessionUnavailable title="未选择学习概念" message="没有可进入的学习概念。"/>
  const cataloged = catalogLesson(entry.routeId, entry.conceptId)
  const firstLesson = resolveFirstLesson({
    routeId: entry.routeId,
    conceptId: entry.conceptId,
    route: { id: route.id, owner: route.owner },
    ...(cataloged ? { catalogLesson: cataloged } : {}),
  })
  if (firstLesson.kind === 'unavailable') return <SessionUnavailable title={firstLesson.title} message={firstLesson.message}/>
  return <SessionLearning key={`${entry.routeId}::${entry.conceptId}`} routeId={entry.routeId} conceptId={entry.conceptId}/>
}

function SessionLearning({ routeId, conceptId }: { routeId: string; conceptId: string }) {
  const selectRootRef = useRef<HTMLDivElement>(null)
  const blueprint = blueprintOf(routeId)
  const title = conceptTitle(blueprint, conceptId) || conceptId
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
  const lesson = getLesson(routeId, conceptId) ?? {
    heading: title,
    paragraphs: [],
    placeholder: `围绕“${title}”继续提问，或选择上方模式深入理解…`,
  }

  useEffect(() => {
    setActiveConversation(conversationRef.current.id)
  }, [])

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
    const userTurn: LearningTurn = {role:'user',text:userText,mode:chosen,quote:cited,quoteFromId:fromId,grow}
    setValue(''); setQuote(''); setQuoteFromId(''); setMode('')
    if (chosen === 'visual') {
      setTurns((old)=>[...old,userTurn,{role:'assistant',text:resolveVisualAnswer().message,mode:chosen,failed:true}])
      return
    }
    if (chosen === 'authors') {
      if (!cited.trim()) {
        setTurns((old)=>[...old,userTurn,{role:'assistant',text:'问博主需要先划选原文，不能在没有证据的情况下指定作者。',mode:chosen,failed:true}])
        return
      }
      setTurns((old)=>[...old,userTurn])
      void requestAskAuthor({ question: asked, quote: cited }).then((result) => {
        if (result.kind === 'authors' && result.authors[0]) {
          const text = result.authors.map((author) => `**${author.name}** ${author.bio}\n${author.text}\n${author.url}`).join('\n\n')
          setTurns((old)=>[...old,{role:'assistant',text,mode:chosen}])
          return
        }
        if (result.kind === 'direct') {
          setTurns((old)=>[...old,{role:'assistant',text:result.text,mode:chosen}])
          return
        }
        setTurns((old)=>[...old,{role:'assistant',text:result.kind === 'unavailable' ? result.message : resolveAskAuthor().message,mode:chosen,failed:true}])
      })
      return
    }
    setTurns((old)=>[...old,userTurn])
    void requestOrdinaryAnswer({ question: asked, topic: title, ...(cited ? { quote: cited } : {}) }).then((result) => {
      if (result.kind !== 'completed') {
        setTurns((old)=>[...old,{role:'assistant',text:result.message,mode:chosen,failed:true}])
        return
      }
      const createdId=appendLearningTurnToGraph(routeId, conceptId, conversationRef.current.id, {
        question: asked,
        quote: cited,
        quoteFromId: fromId,
        reply: result.text,
      })
      setTurns((old)=>[...old,{role:'assistant',text:result.text,mode:chosen,nodeId:createdId}])
    })
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
          <article data-canvas-host="root"><span className="kanshan-avatar">山</span><div>
            <h2>{lesson.heading}</h2>
            {lesson.paragraphs.map((paragraph) => <p key={paragraph}><AnnotatedText text={paragraph} annotations={annotations.annotations} activeId={annotations.active?.id} onOpen={annotations.open}/></p>)}
            {lesson.quote && <blockquote><AnnotatedText text={lesson.quote} annotations={annotations.annotations} activeId={annotations.active?.id} onOpen={annotations.open}/></blockquote>}
            {lesson.figureCaption && <BasisVisual caption={lesson.figureCaption}/>}
          </div></article>
          {turns.map((turn,i)=>turn.role==='user'?<div className="user-turn" key={i}>{turn.text}</div>:<AssistantAnswer key={i} kind={turn.text} host={turn.nodeId || `turn:${i}`} topic={title} failed={turn.failed} mode={turn.mode}/>) }
        </div>
        <div className="mode-prompts"><button className={mode==='visual'?'is-active':''} onClick={()=>setMode(mode==='visual'?'':'visual')}><Icon name="image" size={17}/>图文模式</button></div>
        <Composer compact value={value} onChange={setValue} mode={mode} onMode={setMode} onSend={send} quote={quote} onClearQuote={()=>{setQuote('');setQuoteFromId('')}} showScope={false} showReference={false} showAttachment={false} placeholder={placeholder}/>
      </section>
      {annotations.panelOpen && annotations.active && <AnnotationPanel annotation={annotations.active} onClose={annotations.close}/>}
      {!annotations.panelOpen && annotations.annotations.length > 0 && <button type="button" className="annotation-panel-reopen" aria-label="显示侧边面板" onClick={annotations.reopen}>批注</button>}
      {selection && !authorQuestion && <SelectionToolbar selection={selection} onAddToChat={addToChat} onAskAuthors={openAskAuthors}/>}
      {authorQuestion && <AskAuthorsPrompt selection={authorQuestion} onCancel={()=>setAuthorQuestion(null)} onSubmit={submitAskAuthors}/>}
    </main>
  </ProductWorkspace>
}

function AssistantAnswer({kind,host,failed,mode}:{kind:string;host:string;topic:string;failed?:boolean;mode?:AssistantMode}) {
  if(failed || kind==='authors' || kind==='visual') {
    const unavailable = mode==='visual' || kind==='visual' ? resolveVisualAnswer() : mode==='authors' || kind==='authors' ? resolveAskAuthor() : { title: '无法生成本次回答', message: kind }
    return <section className="assistant-turn" data-canvas-host={host} role="alert"><span className="kanshan-avatar">山</span><div><h2>{unavailable.title}</h2><p>{unavailable.message}</p></div></section>
  }
  return <section className="assistant-turn" data-canvas-host={host}><span className="kanshan-avatar">山</span><div><MarkdownMath source={kind}/></div></section>
}
