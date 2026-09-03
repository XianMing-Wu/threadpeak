import { useEffect, useRef, useState } from 'react'
import { AnnotatedMarkdown, AnnotatedText } from '../components/AnnotatedText'
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
import { annotationScopeId, readSelectionAnchor, type SelectionAnchor } from '../session/ask-authors'
import { useAnnotations, type AskAuthorsAnnotation } from '../session/useAnnotations'
import { parseGrowCommand, resolveQuotedHost } from '../knowledge-canvas/generate'
import { allowedMergeIds, growCandidateList, heuristicGrowDecision, packGraphContext, parseGrowDecision } from '../knowledge-canvas/grow-decision'
import { AgentStatus } from '../components/AgentStatus'
import type { AnswerStatusStage } from '../chat/request-ordinary-answer'
import { MarkdownMath } from '../lib/MarkdownMath'
import { resolveVisualAnswer } from '../chat/resolve-visual-answer'
import { resolveAskAuthor } from '../session/resolve-ask-author'
import { requestAskAuthor } from '../session/request-ask-author'
import { requestOrdinaryAnswerStream } from '../chat/request-ordinary-answer'
import { catalogLesson, blueprintConcepts, conceptTitle } from '../workspace/catalog'
import {
  readActiveConceptId,
  readActiveConversationId,
  closeConceptKnowledge,
  readActiveRouteId,
  readSessionReturn,
  setActiveConversation,
} from '../workspace/nav'
import {
  blueprintOf,
  ensureLearningConversation,
  ensureMineKnowledgeFromCanonical,
  appendLearningTurnToGraph,
  getConceptGraph,
  getConversation,
  getKnowledgeByRoute,
  getLesson,
  getRoute,
  saveConversationDraft,
  startLearningConversation,
} from '../workspace/store'
import type { FirstLesson, LearningTurn } from '../workspace/types'
import { resolveFirstLesson, resolveLearningEntry } from '../session/resolve-learning-entry'
import { resolvePath3DView } from '../path-3d/resolved-path-document'
import { lessonFromCanonical } from '../session/request-canonical-answer'
import { requestFirstEntry, requestFirstEntrySnapshot } from '../session/request-first-entry'
import { NotFoundPage } from './NotFound.tsx'

function readLearningNav() {
  return { routeId: readActiveRouteId(), conceptId: readActiveConceptId() }
}

function leaveLearning(routeId: string) {
  const target = readSessionReturn()
  if (target === 'knowledge-detail') {
    closeConceptKnowledge()
    location.hash = 'knowledge-detail'
    return
  }
  if (target !== 'path-3d') {
    location.hash = target
    return
  }
  const route = getRoute(routeId)
  const view = resolvePath3DView({ routeId, ...(route ? { route } : {}) })
  location.hash = view.kind === 'ready' ? 'path-3d' : 'paths'
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
            <button type="button" className="lesson-back" aria-label="返回上一级" onClick={()=>leaveLearning(readActiveRouteId())}><Icon name="back" size={18}/></button>
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
  if (entry.kind === 'unavailable') return <NotFoundPage/>
  if (!route) return <NotFoundPage/>
  const cataloged = catalogLesson(entry.routeId, entry.conceptId)
  const firstLesson = resolveFirstLesson({
    routeId: entry.routeId,
    conceptId: entry.conceptId,
    route: { id: route.id, owner: route.owner },
    ...(cataloged ? { catalogLesson: cataloged } : {}),
  })
  if (route.owner === 'mine') {
    return <CanonicalSessionGate key={`${entry.routeId}::${entry.conceptId}`} routeId={entry.routeId} conceptId={entry.conceptId}/>
  }
  if (firstLesson.kind === 'unavailable') return <SessionUnavailable title={firstLesson.title} message={firstLesson.message}/>
  return <SessionLearning key={`${entry.routeId}::${entry.conceptId}`} routeId={entry.routeId} conceptId={entry.conceptId}/>
}

function publishedConceptFromRoute(routeId: string, conceptId: string) {
  const route = getRoute(routeId)
  const node = route?.document?.structure.concepts.find((item) => item.id === conceptId)
  const card = node ? route?.document.data.cards.find((item) => item.id === node.cardRef) : undefined
  return {
    title: card?.title || conceptTitle(blueprintOf(routeId), conceptId) || conceptId,
    detailedDescription: (typeof card?.body === 'string' && card.body.trim() ? card.body : card?.summary) || '',
    hasDispute: card?.eyebrow === '有争议',
    attachmentSourceIds: [] as string[],
  }
}

function CanonicalSessionGate({ routeId, conceptId }: { routeId: string; conceptId: string }) {
  const published = publishedConceptFromRoute(routeId, conceptId)
  const title = published.title
  const [lesson, setLesson] = useState<FirstLesson | null>(null)
  const [error, setError] = useState<{ title: string; message: string } | null>(null)
  const [generating, setGenerating] = useState(false)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const existing = await requestFirstEntrySnapshot({ routeId, conceptId })
      if (cancelled) return
      const apply = (result: { text: string; contentHash: string; title: string; graph: Parameters<typeof ensureMineKnowledgeFromCanonical>[0]['graph'] }) => {
        setLesson(lessonFromCanonical(result.title || title, result.text))
        ensureMineKnowledgeFromCanonical({
          routeId,
          conceptId,
          title: result.title || title,
          text: result.text,
          contentHash: result.contentHash,
          graph: result.graph,
        })
      }
      if (existing.kind === 'completed') {
        apply(existing)
        return
      }
      setGenerating(true)
      const created = await requestFirstEntry({
        routeId,
        conceptId,
        title,
        hasDispute: published.hasDispute,
        detailedDescription: published.detailedDescription,
        attachmentSourceIds: published.attachmentSourceIds,
      })
      if (cancelled) return
      if (created.kind !== 'completed') {
        setGenerating(false)
        setError({ title: created.title, message: created.message })
        return
      }
      apply(created)
      setGenerating(false)
    })()
    return () => { cancelled = true }
  }, [conceptId, published.detailedDescription, published.hasDispute, routeId, title])
  if (error) return <SessionUnavailable title={error.title} message={error.message}/>
  if (!lesson) {
    return <ProductWorkspace active="paths" page="session-learning">
      <main className="learning-session">
        <section className="lesson-chat">
          <div className="conversation" role="status" aria-live="polite">
            <article>
              <h2>{generating ? '正在生成这次概念的首次回复' : '正在读取这次概念的首次回复'}</h2>
              <p>第一次进入会并联三路知乎直答并整理成唯一首轮，同时确定性创建唯一根。再次进入只读取已 settle 的首次回复，不再生成。</p>
            </article>
          </div>
        </section>
      </main>
    </ProductWorkspace>
  }
  return <SessionLearning routeId={routeId} conceptId={conceptId} lesson={lesson} graphReady/>
}

function SessionLearning({ routeId, conceptId, lesson: lessonOverride, graphReady = false }: { routeId: string; conceptId: string; lesson?: FirstLesson; graphReady?: boolean }) {
  const selectRootRef = useRef<HTMLDivElement>(null)
  const blueprint = blueprintOf(routeId)
  const title = conceptTitle(blueprint, conceptId) || conceptId
  const conversationRef = useRef(resolveLearningConversation(routeId, conceptId))
  const seed = getConversation(conversationRef.current.id)
  const [conversationId,setConversationId] = useState(conversationRef.current.id)
  const [quote,setQuote] = useState(seed?.quote ?? '')
  const [quoteFromId,setQuoteFromId] = useState('')
  const [selection,setSelection] = useState<SelectionAnchor|null>(null)
  const [authorQuestion,setAuthorQuestion] = useState<SelectionAnchor|null>(null)
  const annotations = useAnnotations(annotationScopeId(routeId, conceptId, conversationId), (item) => {
    if (item.status !== 'ready' || !item.reply?.text) return
    appendLearningTurnToGraph(routeId, conceptId, conversationRef.current.id, {
      question: item.question,
      quote: item.quote,
      quoteFromId: item.nodeId,
      reply: item.reply.text,
      grow: 'par',
      growSource: 'heuristic',
    })
  })
  const [mode,setMode] = useState<AssistantMode>(seed?.mode ?? '')
  const [value,setValue] = useState(seed?.value ?? '')
  const [turns,setTurns] = useState<LearningTurn[]>(seed?.turns ?? [])
  const [awaiting,setAwaiting] = useState(false)
  const [streamText,setStreamText] = useState('')
  const [status,setStatus] = useState<AnswerStatusStage>('search')
  const lesson = lessonOverride ?? getLesson(routeId, conceptId) ?? {
    heading: title,
    paragraphs: [],
    placeholder: `围绕“${title}”继续提问，或选择上方模式深入理解…`,
  }

  useEffect(() => {
    setActiveConversation(conversationRef.current.id)
  }, [])

  useEffect(() => {
    const restore = () => {
      const next = getConversation(readActiveConversationId())
      if (next?.kind !== 'learning' || next.routeId !== routeId || next.conceptId !== conceptId) return
      conversationRef.current = next
      setConversationId(next.id)
      setTurns(next.turns ?? [])
      setValue(next.value ?? '')
      setQuote(next.quote ?? '')
      setMode(next.mode ?? '')
      setAwaiting(false)
      setStreamText('')
    }
    addEventListener(HISTORY_OPEN_EVENT, restore)
    return () => removeEventListener(HISTORY_OPEN_EVENT, restore)
  }, [conceptId, routeId])

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
    const stored = getConversation(conversationRef.current.id)?.turns ?? []
    const keyOf = (item: LearningTurn) => `${item.role}:${item.text}`
    const storedKeys = new Set(stored.map(keyOf))
    const extras = turns.filter((item) => !storedKeys.has(keyOf(item)))
    saveConversationDraft(conversationRef.current.id, {
      turns: stored.length || extras.length ? [...stored, ...extras] : turns,
      value,
      quote,
      mode,
    })
  }, [mode, quote, turns, value])

  const detect = (text:string):AssistantMode => /图|可视化|思维导图|时间线/.test(text)?'visual':/博主|作者|谁.*说/.test(text)?'authors':''
  const resetBranch = () => {
    const next = startLearningConversation(routeId, conceptId)
    conversationRef.current = next
    setActiveConversation(next.id)
    setConversationId(next.id)
    setTurns([])
    setValue('')
    setQuote('')
    setQuoteFromId('')
    setMode('')
    setAwaiting(false)
    setStreamText('')
    setStatus('search')
    setSelection(null)
    setAuthorQuestion(null)
  }
  const send = () => {
    const chosen=mode||detect(value)
    if(!value.trim()&&!quote)return
    const asked=value
    const cited=quote
    const fromId=cited?quoteFromId:''
    const knowledge=getKnowledgeByRoute(routeId)
    const graph=knowledge?getConceptGraph(knowledge.id, conceptId):undefined
    const hostId=graph?resolveQuotedHost(graph.nodes, 'root', cited, fromId):'root'
    const host=graph?.nodes.find((node)=>node.id===hostId)
    const candidates=graph?growCandidateList(graph.nodes, graph.edges, hostId):[]
    const packed=graph?packGraphContext(graph.nodes, graph.edges, hostId, cited):undefined
    const explicit=parseGrowCommand(asked)
    let growDecision=explicit
      ? { ...heuristicGrowDecision(explicit.question || asked, cited, host?.title ?? title), kind: explicit.kind, source: 'command' as const }
      : heuristicGrowDecision(asked, cited, host?.title ?? title)
    const userText=cited?`引用「${cited}」\n${asked}`:asked
    const userTurn: LearningTurn = {role:'user',text:userText,mode:chosen,quote:cited,quoteFromId:fromId,grow:growDecision.kind,growSource:growDecision.source}
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
          appendLearningTurnToGraph(routeId, conceptId, conversationRef.current.id, {
            question: asked,
            quote: cited,
            quoteFromId: fromId,
            reply: text,
            grow: 'par',
            growSource: 'heuristic',
          })
          return
        }
        if (result.kind === 'direct') {
          setTurns((old)=>[...old,{role:'assistant',text:result.text,mode:chosen}])
          appendLearningTurnToGraph(routeId, conceptId, conversationRef.current.id, {
            question: asked,
            quote: cited,
            quoteFromId: fromId,
            reply: result.text,
            grow: 'par',
            growSource: 'heuristic',
          })
          return
        }
        setTurns((old)=>[...old,{role:'assistant',text:result.kind === 'unavailable' ? result.message : resolveAskAuthor().message,mode:chosen,failed:true}])
      })
      return
    }
    setTurns((old)=>[...old,userTurn])
    setAwaiting(true)
    setStatus('search')
    setStreamText('')
    void requestOrdinaryAnswerStream({
      question: asked || cited,
      topic: title,
      ...(cited ? { quote: cited } : {}),
      ...(packed ? { graphContext: packed.text } : {}),
      ...(host?.title ? { hostTitle: host.title } : {}),
      ...(candidates.length ? { candidates } : {}),
      onStatus: (stage) => { setAwaiting(true); setStatus(stage) },
      onGrow: (grow) => {
        if (explicit) return
        growDecision = parseGrowDecision(grow, allowedMergeIds(candidates), {
          question: asked,
          quote: cited,
          hostTitle: host?.title ?? title,
          palId: candidates.find((item) => item.kind === 'par')?.id,
        })
      },
      onDelta: (text) => {
        setAwaiting(false)
        setStreamText(text)
      },
    }).then((result) => {
      setAwaiting(false)
      setStreamText('')
      if (result.kind !== 'completed') {
        setTurns((old)=>[...old,{role:'assistant',text:result.message,mode:chosen,failed:true}])
        return
      }
      const decided = explicit ? growDecision : result.grow
        ? parseGrowDecision(result.grow, allowedMergeIds(candidates), {
          question: asked,
          quote: cited,
          hostTitle: host?.title ?? title,
          palId: candidates.find((item) => item.kind === 'par')?.id,
        })
        : growDecision
      const createdId=appendLearningTurnToGraph(routeId, conceptId, conversationRef.current.id, {
        question: asked,
        quote: cited,
        quoteFromId: fromId,
        reply: result.text,
        grow: decided.kind,
        growSource: decided.source,
        growTitle: decided.title,
        growReason: decided.reason,
        ...(decided.mergeNodeId ? { mergeNodeId: decided.mergeNodeId } : {}),
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
  const knowledgeReady = graphReady || Boolean(getKnowledgeByRoute(routeId))
  const placeholder = lesson.placeholder || `围绕“${title}”继续提问，或选择上方模式深入理解…`

  return <ProductWorkspace active="paths" page="session-learning">
    <main className="learning-session">
      <section className="lesson-chat">
        <header>
          <div className="lesson-heading">
            <button type="button" className="lesson-back" aria-label="返回上一级" onClick={()=>leaveLearning(routeId)}><Icon name="back" size={18}/></button>
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
            <AnnotatedMarkdown
              className="lesson-markdown"
              source={lesson.paragraphs.join('\n\n')}
              annotations={annotations.annotations.filter((item) => item.nodeId === 'root')}
              activeId={annotations.active?.id}
              onOpen={annotations.open}
            />
            {lesson.quote && <blockquote><AnnotatedText text={lesson.quote} annotations={annotations.annotations} activeId={annotations.active?.id} onOpen={annotations.open}/></blockquote>}
            {lesson.figureCaption && <BasisVisual caption={lesson.figureCaption}/>}
          </div></article>
          {turns.map((turn,i)=>{
            const annotationTurn = turn.role==='user' && annotations.annotations.some((item)=>item.quote && turn.text.includes(`引用「${item.quote}」`) && turn.text.includes(item.question))
            const afterAnnotation = turn.role==='assistant' && i>0 && annotations.annotations.some((item)=>item.quote && (turns[i-1]?.text.includes(`引用「${item.quote}」`) ?? false) && (turns[i-1]?.text.includes(item.question) ?? false))
            if (annotationTurn || afterAnnotation) return null
            return turn.role==='user'
              ? <div className="user-turn" key={i}>{turn.text}</div>
              : <AssistantAnswer key={i} kind={turn.text} host={turn.nodeId || `turn:${i}`} failed={turn.failed} mode={turn.mode} annotations={annotations.annotations.filter((item)=>item.nodeId===(turn.nodeId || `turn:${i}`))} activeId={annotations.active?.id} onOpen={annotations.open}/>
          }) }
          {awaiting && !streamText && <section className="assistant-turn" role="status" aria-live="polite"><span className="kanshan-avatar">山</span><div><AgentStatus items={[{ label: status === 'classify' ? '正在判断这个问题在知识脉络中的位置' : status === 'compose' ? '正在生成回答' : '正在检索公开证据并生成回答', detail: status === 'classify' ? '模型会同时给出前置、后置或并列，以及卡片标题和逻辑说明。' : '先检索知乎公开内容，再由模型写出这次回复。' }]}/></div></section>}
          {streamText && <section className="assistant-turn" data-canvas-host="pending"><span className="kanshan-avatar">山</span><div><MarkdownMath source={streamText}/></div></section>}
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

function AssistantAnswer({kind,host,failed,mode,annotations,activeId,onOpen}:{kind:string;host:string;failed?:boolean;mode?:AssistantMode;annotations:readonly AskAuthorsAnnotation[];activeId?:string|null;onOpen:(id:string)=>void}) {
  if(failed || kind==='authors' || kind==='visual') {
    const unavailable = mode==='visual' || kind==='visual' ? resolveVisualAnswer() : mode==='authors' || kind==='authors' ? resolveAskAuthor() : { title: '无法生成本次回答', message: kind }
    return <section className="assistant-turn" data-canvas-host={host} role="alert"><span className="kanshan-avatar">山</span><div><h2>{unavailable.title}</h2><p>{unavailable.message}</p></div></section>
  }
  return <section className="assistant-turn" data-canvas-host={host}><span className="kanshan-avatar">山</span><div><AnnotatedMarkdown source={kind} annotations={annotations} activeId={activeId} onOpen={onOpen}/></div></section>
}
