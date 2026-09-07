import { ExampleWorkspace } from '../learning-v2/ExampleWorkspace'
import { LearningWorkspace } from '../learning-v2/Workspace'
import { useEffect, useRef, useState } from 'react'
import { AnnotatedMarkdown, AnnotatedText } from '../components/AnnotatedText'
import { AnnotationPanel } from '../components/AnnotationPanel'
import { AskAuthorsPrompt } from '../components/AskAuthorsPrompt'
import { BasisVisual } from '../components/BasisVisual'
import type { AssistantMode } from '../assistant-mode'
import { Composer } from '../components/Composer'
import { EmptyStatus } from '../components/EmptyStatus'
import { KanshanAvatar } from '../components/KanshanAvatar'
import { SelectionToolbar } from '../components/SelectionToolbar'
import { ProductWorkspace } from '../components/Shell'
import { Icon } from '../icons'
import { HISTORY_OPEN_EVENT } from '../history'
import { openKnowledgeCanvas } from '../learningSession'
import { annotationScopeId, readSelectionAnchor, type SelectionAnchor } from '../session/ask-authors'
import { useAnnotations, type AskAuthorsAnnotation } from '../session/useAnnotations'
import { AgentStatus } from '../components/AgentStatus'
import { ProcessTrace } from '../components/ProcessTrace'
import { applyReasoning, asProcessSteps, flowSteps, settleTrace, type ProcessStep } from '../process-trace'
import { MarkdownMath } from '../lib/MarkdownMath'
import { requestFollowUp } from '../session/request-follow-up'
import { buildFollowUpMessages, buildFollowUpNeighborhood, followUpQuoteForG2 } from '../session/build-follow-up-context'
import { readLearningThinking, subscribeLearningThinking, writeLearningThinking } from '../session/learning-thinking'
import { resolveFollowUpHost, turnAllowsSelection } from '../session/resolve-follow-up-host'
import { catalogLesson, blueprintConcepts, conceptCarrier, conceptTitle } from '../workspace/catalog'
import {
  readActiveConceptId,
  readActiveConversationId,
  readActiveRouteId,
  setActiveConversation,
} from '../workspace/nav'
import {
  blueprintOf,
  ensureLearningConversation,
  ensureMineKnowledgeFromCanonical,
  appendFollowUpTurn,
  getConceptGraph,
  getConversation,
  getKnowledgeByRoute,
  getLesson,
  getRoute,
  hasSettledMineConcept,
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
        <div className="conversation ux-status-region" role="alert">
          <EmptyStatus
            kind="error"
            title="无法进入这次学习"
            body={props.message}
            action="去看我的路线"
            onAction={() => { location.hash = 'paths' }}
          />
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
  if(route.owner==='example'&&route.knowledgeId)return <ProductWorkspace active="knowledge" page="session-learning"><ExampleWorkspace knowledgeId={route.knowledgeId} conceptId={entry.conceptId} initialView="research" onBack={()=>{location.hash='path-3d'}}/></ProductWorkspace>
  const cataloged = catalogLesson(entry.routeId, entry.conceptId)
  const firstLesson = resolveFirstLesson({
    routeId: entry.routeId,
    conceptId: entry.conceptId,
    route: { id: route.id, owner: route.owner },
    ...(cataloged ? { catalogLesson: cataloged } : {}),
  })
  if (route.owner === 'mine') {
    return <LearningWorkspace key={`${entry.routeId}::${entry.conceptId}`} routeId={entry.routeId} conceptId={entry.conceptId}/>
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
  const [trace, setTrace] = useState<ProcessStep[]>([])
  const [draft, setDraft] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [thinkingDepth, setThinkingDepth] = useState(readLearningThinking)
  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => subscribeLearningThinking(() => setThinkingDepth(readLearningThinking())), [])
  useEffect(() => {
    let cancelled = false
    setDraft('')
    abortRef.current?.abort()
    const abort = new AbortController()
    abortRef.current = abort
    void (async () => {
      const apply = (result: { text: string; contentHash: string; title: string; graph: Parameters<typeof ensureMineKnowledgeFromCanonical>[0]['graph']; trace?: ProcessStep[] }) => {
        if (result.trace?.length) setTrace(settleTrace(result.trace))
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
      const onDraft = (text: string) => { if (!cancelled) setDraft(text) }
      const existing = await requestFirstEntrySnapshot({
        routeId,
        conceptId,
        onTrace: (steps) => { if (!cancelled) setTrace(steps) },
        onDraft,
        signal: abort.signal,
      })
      if (cancelled) return
      if (existing.kind === 'completed') {
        apply(existing)
        return
      }
      if (existing.kind === 'unavailable' && existing.trace.length) setTrace(existing.trace)
      const created = await requestFirstEntry({
        routeId,
        conceptId,
        title,
        hasDispute: published.hasDispute,
        detailedDescription: published.detailedDescription,
        attachmentSourceIds: published.attachmentSourceIds,
        thinkingDepth,
        onTrace: (steps) => { if (!cancelled) setTrace(steps) },
        onDraft,
        signal: abort.signal,
      })
      if (cancelled) return
      if (created.kind === 'running') { setTrace(created.trace); return }
      if (created.kind !== 'completed') {
        if (abort.signal.aborted || created.message === '生成已停止。') {
          setTrace((current) => settleTrace(created.trace.length ? created.trace : current, 'stopped'))
          return
        }
        setTrace((current) => created.trace.length ? created.trace : settleTrace(current, 'failed'))
        setError({ title: created.title, message: created.message })
        return
      }
      apply(created)
      setError(null)
    })()
    return () => { cancelled = true; abort.abort() }
  }, [attempt, conceptId, published.detailedDescription, published.hasDispute, routeId, title])
  if (lesson) return <SessionLearning routeId={routeId} conceptId={conceptId} lesson={lesson} graphReady entryTrace={trace}/>
  return <ProductWorkspace active="paths" page="session-learning">
    <main className="learning-session">
      <section className="lesson-chat">
        <div className="conversation" role={error ? 'alert' : 'status'} aria-live="polite">
          {trace.length > 0 && <div className="route-agent-status"><ProcessTrace steps={error ? settleTrace(trace, 'failed') : trace}/></div>}
          {draft && !error ? <article data-canvas-host="root"><KanshanAvatar /><div>
            <h2>{title}</h2>
            <MarkdownMath source={draft}/>
          </div></article> : null}
          {!error && (draft || trace.some((step) => step.status === 'running')) ? <button type="button" className="generation-stop" onClick={() => abortRef.current?.abort()}>停止生成</button> : null}
          {error ? <EmptyStatus
            kind="error"
            eyebrow="本次生成未完成"
            title={error.title}
            body={error.message}
            action="重试"
            onAction={() => { setError(null); setDraft(''); setAttempt((value) => value + 1) }}
          /> : null}
        </div>
      </section>
    </main>
  </ProductWorkspace>
}

function SessionLearning({ routeId, conceptId, lesson: lessonOverride, graphReady = false, entryTrace = [] }: { routeId: string; conceptId: string; lesson?: FirstLesson; graphReady?: boolean; entryTrace?: ProcessStep[] }) {
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
  const annotations = useAnnotations(annotationScopeId(routeId, conceptId))
  const [mode,setMode] = useState<AssistantMode>(seed?.mode ?? '')
  const [value,setValue] = useState(seed?.value ?? '')
  const [turns,setTurns] = useState<LearningTurn[]>(seed?.turns ?? [])
  const [awaiting,setAwaiting] = useState(false)
  const [streamText,setStreamText] = useState('')
  const [trace,setTrace] = useState<ProcessStep[]>([])
  const [thinkingDepth, setThinkingDepth] = useState(readLearningThinking)
  const followAbort = useRef<AbortController | null>(null)
  useEffect(() => subscribeLearningThinking(() => setThinkingDepth(readLearningThinking())), [])
  const lesson = lessonOverride ?? getLesson(routeId, conceptId) ?? {
    heading: title,
    paragraphs: [],
    placeholder: `围绕“${title}”继续提问，或引用上方内容…`,
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
    setSelection(null)
    setAuthorQuestion(null)
  }
  const send = () => {
    const asked = value
    const lessonText = lesson.paragraphs.join('\n\n')
    const resolved = resolveFollowUpHost({
      question: asked,
      quote,
      quoteFromId,
      turns,
      root: { nodeId: 'root', content: lessonText },
    })
    if (!resolved.ok) return
    const knowledge = getKnowledgeByRoute(routeId)
    const graph = knowledge ? getConceptGraph(knowledge.id, conceptId) : undefined
    const nodes = graph?.nodes ?? [{
      id: 'root',
      accent: '#158f81',
      title,
      role: 'flow' as const,
      turns: [{ question: title, replyKind: 'full' as const, paragraphs: lesson.paragraphs }],
    }]
    const neighborhood = buildFollowUpNeighborhood({
      nodes,
      edges: graph?.edges ?? [],
      hostNodeId: resolved.hostNodeId,
      annotations: annotations.annotations,
    })
    if (!neighborhood) return
    const messages = buildFollowUpMessages({ lessonText, turns, annotations: annotations.annotations })
    const g2Quote = followUpQuoteForG2(resolved, messages)
    const cited = resolved.quote.text || ''
    const userText = cited ? `引用「${cited}」\n${asked}` : asked
    setTurns((old)=>[...old,{role:'user',text:userText,quote:cited,quoteFromId:resolved.hostNodeId}])
    setValue(''); setQuote(''); setQuoteFromId(''); setMode('')
    setAwaiting(true)
    setStreamText('')
    setTrace(flowSteps('follow-up'))
    followAbort.current?.abort()
    const abort = new AbortController()
    followAbort.current = abort
    void requestFollowUp({
      routeId,
      conceptId,
      conversationId: conversationRef.current.id,
      question: asked,
      hostNodeId: resolved.hostNodeId,
      quote: { nodeId: resolved.quote.nodeId, text: resolved.quote.text, messageId: g2Quote.messageId },
      neighborhood,
      messages,
      thinkingDepth,
      signal: abort.signal,
      onDelta: (text) => { setAwaiting(false); setStreamText(text) },
      onTrace: (steps) => {
        const parsed = asProcessSteps(steps)
        if (parsed) setTrace(parsed)
      },
      onReasoning: (id, thought) => setTrace((current) => applyReasoning(current, id, thought)),
    }).then((result) => {
      if (abort.signal.aborted) {
        setAwaiting(false)
        setTrace((current) => settleTrace(current, 'stopped'))
        return
      }
      setAwaiting(false)
      setStreamText('')
      setTrace((current) => settleTrace(current, result.kind === 'completed' ? 'done' : 'failed'))
      if (result.kind !== 'completed') {
        setTurns((old)=>[...old,{role:'assistant',text:result.message,failed:true}])
        return
      }
      const createdId = appendFollowUpTurn(routeId, conceptId, conversationRef.current.id, {
        question: asked,
        quote: cited,
        quoteFromId: resolved.hostNodeId,
        reply: result.text,
        grow: result.grow,
      })
      setTurns((old)=>[...old,{role:'assistant',text:result.text,nodeId:createdId}])
    })
  }
  const onSelect = () => {
    if (authorQuestion) return
    setSelection(readSelectionAnchor(selectRootRef.current, (node) => {
      const el = node instanceof Element ? node : node.parentElement
      if (el?.closest('[data-failed]')) return undefined
      return el?.closest('[data-canvas-host]')?.getAttribute('data-canvas-host') || undefined
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
    const nodeId = authorQuestion.nodeId || 'root'
    const knowledge = getKnowledgeByRoute(routeId)
    const graph = knowledge ? getConceptGraph(knowledge.id, conceptId) : undefined
    const node = graph?.nodes.find((item) => item.id === nodeId)
    const hostContent = node
      ? node.turns.flatMap((turn) => turn.paragraphs).join('\n\n')
      : lesson.paragraphs.join('\n\n')
    annotations.create(authorQuestion.text, question, nodeId, {
      hostContent,
      carrier: conceptCarrier(blueprint, conceptId),
      concept: { id: conceptId, title },
      thinkingDepth,
    })
    setAuthorQuestion(null)
  }
  const knowledgeReady = graphReady || hasSettledMineConcept(routeId, conceptId) || getRoute(routeId)?.owner === 'example'
  const placeholder = lesson.placeholder || `围绕“${title}”继续提问，或引用上方内容…`

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
          {entryTrace.length > 0 && <div className="route-agent-status"><ProcessTrace steps={settleTrace(entryTrace)}/></div>}
          <article data-canvas-host="root"><KanshanAvatar /><div>
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
              ? <div className="user-turn" key={i} data-canvas-host={turnAllowsSelection(turns, i) ? `user:${i}` : undefined} data-failed={turnAllowsSelection(turns, i) ? undefined : 'true'}>{turn.text}</div>
              : <AssistantAnswer key={i} kind={turn.text} host={turn.failed ? undefined : (turn.nodeId || `turn:${i}`)} failed={turn.failed} annotations={annotations.annotations.filter((item)=>item.nodeId===(turn.nodeId || `turn:${i}`))} activeId={annotations.active?.id} onOpen={annotations.open}/>
          }) }
          {(awaiting || trace.length > 0) && <section className="assistant-turn" role="status" aria-live="polite"><KanshanAvatar /><div>
            {trace.length > 0 ? <ProcessTrace steps={awaiting && !streamText ? trace : settleTrace(trace)}/> : awaiting && !streamText ? <AgentStatus flow="follow-up"/> : null}
            {streamText ? <MarkdownMath source={streamText}/> : null}
          </div></section>}
        </div>
        <Composer compact value={value} onChange={setValue} onSend={send} quote={quote} onClearQuote={()=>{setQuote('');setQuoteFromId('')}} showAttachment={false} placeholder={placeholder} requireQuestion thinkingDepth={thinkingDepth} onThinkingDepth={(next) => { writeLearningThinking(next); setThinkingDepth(next) }} busy={awaiting} onStop={() => followAbort.current?.abort()}/>
      </section>
      {annotations.panelOpen && annotations.active && <AnnotationPanel annotation={annotations.active} onClose={annotations.close}/>}
      {!annotations.panelOpen && annotations.annotations.length > 0 && <button type="button" className="annotation-panel-reopen" aria-label="显示侧边面板" onClick={annotations.reopen}>批注</button>}
      {selection && !authorQuestion && <SelectionToolbar selection={selection} onAddToChat={addToChat} onAskAuthors={openAskAuthors}/>}
      {authorQuestion && <AskAuthorsPrompt selection={authorQuestion} onCancel={()=>setAuthorQuestion(null)} onSubmit={submitAskAuthors}/>}
    </main>
  </ProductWorkspace>
}

function AssistantAnswer({kind,host,failed,annotations,activeId,onOpen}:{kind:string;host?:string;failed?:boolean;annotations:readonly AskAuthorsAnnotation[];activeId?:string|null;onOpen:(id:string)=>void}) {
  if(failed) {
    const unavailable = { title: '无法生成本次回答', message: kind }
    return <section className="assistant-turn" data-failed="true" role="alert"><KanshanAvatar /><div><EmptyStatus kind="error" density="inline" title={unavailable.title} body={unavailable.message} /></div></section>
  }
  return <section className="assistant-turn" data-canvas-host={host}><KanshanAvatar /><div><AnnotatedMarkdown source={kind} annotations={annotations} activeId={activeId} onOpen={onOpen}/></div></section>
}
