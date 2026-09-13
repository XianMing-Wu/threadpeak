import {observeResource} from '../learning-v2/resource-stream'
import {newChat} from '../chat/launch'
import { productRequest } from '../learning-v2/client'
import {pollResource,foregroundDelay,taskPollInterval} from '../learning-v2/poll'
import { refreshProductLibrary } from '../learning-v2/library'
import { useEffect, useRef, useState } from 'react'
import { AgentStatus } from '../components/AgentStatus'
import { ConfirmedQuestion } from '../components/ProcessTrace'
import { asProcessSteps, flowSteps, settleTrace, uniqueTrace, type ProcessStep } from '../process-trace'
import { EmptyStatus } from '../components/EmptyStatus'
import { Icon } from '../icons'
import { openRoute } from '../workspace/nav'
import { addChatHistory, removeChatHistory } from '../history'
import { createMineRouteFromChat, getConversation, getRoute, loadConversationTrace, saveConversationTrace } from '../workspace/store'
import {
  followUpPathRun,
  getPathRun,
  readPathLaunchAttachments,
  replyPathRun,
  retryPathRun,
  selectPathAnswer,
  submitCustomPathAnswer,
  startPathRun,
  watchPathRun,
  type PathRunView,
  type PathRunWatch,
} from './path-run-client.ts'
import { MarkdownMath } from '../lib/MarkdownMath'

const CUSTOM_ANSWER = '__custom__'
const optionLetters = ['A', 'B', 'C', 'D'] as const

function publicPathErrorMessage(message: string | undefined): string {
  if (!message || /指定结构|该 Agent|schema|JSON 解析|模型没有返回 JSON/i.test(message)) {
    return '生成学习路线这一步还没通过校验。前面的检索和选择题都还在，请重试这一步。'
  }
  return message
}

function RouteReadyCard(props: { title: string; routeId: string }) {
  return <section className="route-ready-card">
    <span><Icon name="check" size={20}/></span>
    <div>
      <small>路线已生成</small>
      <h2>{props.title}</h2>
      <p>选择一个概念开始学习，相关文章与讲解会逐步呈现。</p>
      <button type="button" onClick={() => { openRoute(props.routeId, 'paths'); location.hash = 'path-3d' }}>
        进入学习路线 <Icon name="arrow-right" size={16}/>
      </button>
    </div>
  </section>
}

function publish(view: PathRunView, query: string, conversationId: string, onRouteReady: (id: string) => void) {
  if (!view.document || view.knowledgeCreated !== false) return ''
  const route = createMineRouteFromChat(query, [], conversationId, view.document as Parameters<typeof createMineRouteFromChat>[3], view.runId)
  onRouteReady(route.id)
  return route.id
}

export function ChatRoutePanel(props: {
  conversationId: string
  query: string
  existingRouteId?: string
  generate?:boolean
  resourceId?:string
  thinkingDepth?: 'fast' | 'deep'
  onRouteReady: (routeId: string) => void
  onSender?: (handler: (text: string) => Promise<boolean>) => void
  onGenerating?: (busy: boolean) => void
  onStopRef?: (stop: () => void) => void
}) {
  const existing = props.existingRouteId ? getRoute(props.existingRouteId) : undefined
  const [view, setView] = useState<PathRunView | null>(null)
  const [pending, setPending] = useState(false)
  const [stopNotice,setStopNotice]=useState('')
  const [replies, setReplies] = useState<{ user: string; assistant: string }[]>([])
  const [readyRouteId, setReadyRouteId] = useState(existing?.id ?? '')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [customDrafts, setCustomDrafts] = useState<Record<string, string>>({})
  const storedTrace = loadConversationTrace(props.conversationId, props.existingRouteId)
  const [keptTrace, setKeptTrace] = useState<ProcessStep[]>(storedTrace)
  const keptRef = useRef(storedTrace)
  keptRef.current = keptTrace
  const readyRef = useRef(readyRouteId)
  readyRef.current = readyRouteId
  const [confirmed, setConfirmed] = useState<Record<string, string>>({})
  const launched = useRef('')
  const libraryStages=useRef(new Set<string>())
  const abortRef = useRef<AbortController | null>(null)
  const mounted=useRef(true)
  const executing=useRef(false),stopping=useRef<Promise<void>|null>(null),currentView=useRef(view)
  currentView.current=view
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;launched.current='';abortRef.current?.abort();abortRef.current=null;executing.current=false}},[])

  const persistTrace = (steps: readonly ProcessStep[], extra?: { pathRunId?: string; routeId?: string; routeStep?: number }) => {
    const processTrace = uniqueTrace(steps)
    setKeptTrace(processTrace)
    keptRef.current = processTrace
    saveConversationTrace(props.conversationId, processTrace, {
      ...(extra?.pathRunId ? { pathRunId: extra.pathRunId } : {}),
      ...(extra?.routeStep !== undefined ? { routeStep: extra.routeStep } : {}),
      routeId: extra?.routeId || readyRef.current || existing?.id,
    })
    return processTrace
  }

  const persist = (next: PathRunView) => {
    const incoming = asProcessSteps(next.trace) ?? []
    const merged = incoming.length ? incoming : keptRef.current
    const processTrace = next.status === 'published' || next.status === 'failed'
      ? settleTrace(merged, next.status === 'failed' ? 'failed' : 'done')
      : merged
    persistTrace(processTrace, {
      ...(next.runId ? { pathRunId: next.runId } : {}),
      ...(next.status === 'awaiting_answers' ? { routeStep: 1 } : {}),
    })
  }

  const apply = (next: PathRunView, options?: { dropOnFail?: boolean }) => {
    if(!mounted.current)return
    setView(next)
    const libraryStage=`${next.runId}:${next.status}`
    if(next.runId&&!libraryStages.current.has(libraryStage)){libraryStages.current.add(libraryStage);void refreshProductLibrary().catch(()=>{})}
    setConfirmed(Object.assign({},...next.questionSets.map(set=>set.selectedOptionIds)))
    if (next.status === 'failed') {
      // A recoverable task retains its history and selected answers.
      persist(next)
      return
    }
    persist(next)
    if (next.status === 'published' && next.document) {
      try {
        const routeId = publish(next, props.query, props.conversationId, props.onRouteReady)
        if (routeId) {
          setReadyRouteId(routeId)
          readyRef.current = routeId
          persistTrace(keptRef.current, { pathRunId: next.runId, routeId })
          addChatHistory(props.query, 'route', { id: props.conversationId, routeId });void refreshProductLibrary().catch(()=>{})
        }
      } catch {
        setReadyRouteId('')
        // The server still owns the published route; the user may reopen it.
      }
      return
    }
    if (next.status === 'awaiting_answers') {
      addChatHistory(props.query, 'route', { id: props.conversationId })
    }
  }

  const stop = () => {
    const id=currentView.current?.runId
    if(!id||stopping.current)return
    const stopTask=(async()=>{
      try{setStopNotice('');await productRequest(`/api/v2/resources/${id}/cancel`,{method:'POST',body:{}});apply(await getPathRun(id))}
      catch(error){if(mounted.current)setStopNotice(error instanceof Error?error.message:'停止尚未确认，请重试。')}
    })()
    stopping.current=stopTask
    void stopTask.finally(()=>{if(stopping.current===stopTask)stopping.current=null})
  }

  const run = async (work: (watch: PathRunWatch) => Promise<PathRunView>) => {
    if(executing.current||stopping.current)return false
    executing.current=true
    abortRef.current?.abort()
    const abort = new AbortController()
    abortRef.current = abort
    setPending(true)
    props.onGenerating?.(true)
    const watch: PathRunWatch = {
      thinkingDepth: props.thinkingDepth ?? 'fast',
      commandKey:`route-start:${props.conversationId}`,
      onUpdate: (next) => {if(abortRef.current===abort&&!abort.signal.aborted)apply(next, { dropOnFail: false })},
      signal: abort.signal,
    }
    try {
      const next=await work(watch)
      if(!mounted.current||abortRef.current!==abort)return false
      apply(next, { dropOnFail: true })
      return next.status!=='failed'
    } catch (error) {
      if(!mounted.current||abortRef.current!==abort)return false
      if (abort.signal.aborted) return false
      setView({
        runId: view?.runId ?? '',
        goal: props.query,
        status: 'failed',
        stage: 'failed',
        trace: view?.trace ?? [],
        questionSets: view?.questionSets ?? [],
        knowledgeCreated: false,
        error: { code: 'PROVIDER_UNAVAILABLE', message: error instanceof Error ? error.message : '路线服务不可用。' },
      })
      return false
    } finally {
      if(stopping.current)await stopping.current
      if(abortRef.current===abort)executing.current=false
      if(mounted.current&&abortRef.current===abort){setPending(false);props.onGenerating?.(false)}
    }
  }

  const retryLastStep = () => {
    const attachments = readPathLaunchAttachments(props.conversationId)
    const start = (watch: PathRunWatch) => startPathRun({
      goal: props.query,
      thinkingDepth: props.thinkingDepth,
      ...(attachments ? { attachments } : {}),
    }, watch)
    void run(async (watch) => {
      if (!view?.runId){if(props.generate===false)throw new Error('请从历史记录重新打开这次路线。');return start(watch)}
      const next = await retryPathRun(view.runId, watch)
      return next
    })
  }

  useEffect(() => {
    props.onStopRef?.(stop)
  })

  useEffect(() => {
    const stored = getConversation(props.conversationId)
    const restoreId=props.resourceId??stored?.pathRunId
    if (restoreId) {
      const runId = restoreId
      const key = `restore:${runId}`
      if (launched.current === key) return
      launched.current = key
      void run(async watch=>watchPathRun(await getPathRun(runId,watch.signal),watch))
      return
    }
    if (existing) {
      const storedTraces = loadConversationTrace(props.conversationId, existing.id)
      if (storedTraces.length) persistTrace(settleTrace(storedTraces))
      return
    }
    if(props.generate===false){setView({runId:'',goal:props.query,status:'failed',stage:'',questionSets:[],knowledgeCreated:false,recoverable:false,error:{code:'RESTORE_REQUIRED',message:'未找到这次路线的恢复标识，请从历史记录重新打开。'}});return}
    const key = `${props.conversationId}::${props.query}`
    if (launched.current === key) return
    launched.current = key
    const attachments = readPathLaunchAttachments(props.conversationId)
    void run((watch) => startPathRun({ goal: props.query, thinkingDepth: props.thinkingDepth, ...(attachments ? { attachments } : {}) }, watch))
  }, [props.existingRouteId, props.conversationId, props.query, props.resourceId, props.generate])

  const preparingRun = !pending && view?.status === 'awaiting_answers' && view.preparing ? view.runId : undefined
  useEffect(() => {
    if (!preparingRun) return
    const abort = new AbortController()
    const stream=observeResource(preparingRun,{signal:abort.signal,onChange:()=>window.dispatchEvent(new Event('threadpeak:resource-change'))})
    // Keep catalog progress/retry visible without blocking answers. A submission
    // cancels this reader so its older snapshot cannot overwrite the saved answer.
    void pollResource(async () => {
      const next = await getPathRun(preparingRun, abort.signal)
      if (abort.signal.aborted) return false
      apply(next)
      return next.preparing === true && next.status === 'awaiting_answers'
    }, {signal: abort.signal, wait: foregroundDelay, intervalMs: () => taskPollInterval('running')})
    return () => {stream.close();abort.abort()}
  }, [preparingRun])

  useEffect(() => {
    props.onSender?.(async (text) => {
      if (!view) return false
      if (view.status === 'awaiting_answers') {
        return run((watch) => followUpPathRun(view.runId, text, watch))
      }
      if (view.status === 'published') {
        return run(async (watch) => {
          const next = await replyPathRun(view.runId, text, watch)
          if (mounted.current&&next.reply) setReplies((current) => [...current, { user: text, assistant: next.reply ?? '' }])
          return next
        })
      }
      return false
    })
  }, [props, view])

  const publishedTitle = existing?.title ?? view?.document?.metadata?.title ?? view?.route?.title ?? props.query
  const enterRouteId = readyRouteId || existing?.id || ''
  const liveTrace = view?.trace?.length
    ? view.trace
    : (pending || view?.status === 'running')
      ? flowSteps('path-start')
      : []
  const merged = view?.trace?.length ? view.trace : uniqueTrace([...keptTrace, ...liveTrace])
  const steps = view?.status === 'published' || view?.status === 'failed' || (!view && Boolean(existing))
    ? settleTrace(merged, view?.status === 'failed' ? 'failed' : 'done')
    : merged
  // Choices sit between question preparation and route generation, including
  // restored history. Keep later steps below the answers in every task state.
  const answerBoundary = steps.findIndex(step => step.id === 'route:choices' || step.id.endsWith(':plan') || step.id === 'r4')
  const beforeAnswers = answerBoundary < 0 ? steps : steps.slice(0, answerBoundary)
  const afterAnswers = answerBoundary < 0 ? [] : steps.slice(answerBoundary)

  return <article className="route-clarification">{stopNotice&&<p role="alert">{stopNotice}</p>}
    {beforeAnswers.length > 0 ? <AgentStatus steps={beforeAnswers} /> : null}
    {(view?.questionSets ?? []).map((set) => (
      <div key={`set-${set.round}`} className="clarification-stack" role="group" aria-label={set.status === 'active' ? '聊聊你的学习目标' : `第 ${set.round} 轮已确认`}>
        {set.message && <div className="clarification-intro"><MarkdownMath source={set.message}/></div>}
        {set.questions.map((question, questionIndex) => {
          const submitted = set.selectedOptionIds[question.id] || confirmed[question.id]
          const customAnswer = set.customAnswers?.[question.id]
          if (submitted || customAnswer || set.status !== 'active') return <ConfirmedQuestion key={question.id} question={question.prompt} answer={customAnswer ?? (submitted ? question.options.find(option => option.id === submitted)?.label : undefined)} />
          if (set.questions.slice(0, questionIndex).some(q => !set.selectedOptionIds[q.id] && !set.customAnswers?.[q.id])) return null
          const selectedId = drafts[question.id]
          return (
            <section key={question.id} className="clarification-card" data-question={question.id}>
              <div className="clarification-card__header">
                <div className="clarification-card__main">
                  <div className="clarification-card__copy">
                    <h3 className="clarification-card__question">{question.prompt}</h3>
                    <p className="clarification-card__description">{question.reason ?? "选一个贴近你的，也可以用自己的话说"}</p>
                  </div>
                </div>
              </div>
              <div className="clarification-options">
                {question.options.map((option, index) => (
                  <button
                    key={option.id}
                    type="button"
                    className={selectedId === option.id ? 'is-selected' : ''}
                    disabled={pending || view?.status !== 'awaiting_answers'}
                    aria-pressed={selectedId === option.id}
                    onClick={() => setDrafts((currentDrafts) => ({ ...currentDrafts, [question.id]: option.id }))}
                  >
                    <span className="option-letter">{optionLetters[index]}</span>
                    <strong>{option.label}</strong>
                  </button>
                ))}
                <label className={`clarification-custom-row ${selectedId === CUSTOM_ANSWER ? 'is-selected' : ''}`}>
                  <span className="option-letter"><Icon name="edit" size={14}/></span>
                  <textarea id={`custom-${question.id}`} className="clarification-custom-input"
                    aria-label="用自己的话回答" rows={1} maxLength={4000} placeholder="我想自己说"
                    value={customDrafts[question.id] ?? ''} disabled={pending || view?.status !== 'awaiting_answers'}
                    onFocus={() => setDrafts(current => ({...current, [question.id]: CUSTOM_ANSWER}))}
                    onChange={event => {
                      setDrafts(current => ({...current, [question.id]: CUSTOM_ANSWER}))
                      setCustomDrafts(current => ({...current, [question.id]: event.target.value}))
                      event.target.style.height='auto';event.target.style.height=`${Math.min(160,event.target.scrollHeight)}px`
                    }}/>
                </label>
              </div>
              <div className="clarification-card__footer">
                <button
                  type="button"
                  className="clarification-submit"
                  disabled={pending || view?.status !== 'awaiting_answers' || !selectedId || selectedId === CUSTOM_ANSWER && !customDrafts[question.id]?.trim()}
                  onClick={() => {
                    if (!selectedId) return
                    void run((watch) => selectedId === CUSTOM_ANSWER
                      ? submitCustomPathAnswer(view!.runId, question.id, customDrafts[question.id]!, watch)
                      : selectPathAnswer(view!.runId, question.id, selectedId, watch))
                  }}
                >
                  继续
                </button>
              </div>
            </section>
          )
        })}
      </div>
    ))}
    {view?.followUpMessage && !view.questionSets.some(s=>s.message===view.followUpMessage) && view.status === 'awaiting_answers' && <article className="chat-answer"><MarkdownMath source={view.followUpMessage}/></article>}
    {afterAnswers.length > 0 ? <AgentStatus steps={afterAnswers} /> : null}
    {(view?.status === 'failed' || view?.error) && <section className="route-ready-card" role="alert">
      <EmptyStatus
        kind="error"
        eyebrow="本次生成未完成"
        title="学习路线还没生成完"
        body={publicPathErrorMessage(view.error?.message)}
        action={view.recoverable===false?undefined:"重试这一步"}
        onAction={view.recoverable===false?undefined:retryLastStep}
      />
      <button type="button" onClick={newChat}>重新制定路线</button>
    </section>}
    {(view?.status === 'published' || (!view && existing)) && enterRouteId && <RouteReadyCard title={publishedTitle} routeId={enterRouteId}/>}
    {replies.map((item, index) => <div key={index}>
      <div className="query-user-bubble">{item.user}</div>
      <article className="chat-answer"><MarkdownMath source={item.assistant}/></article>
    </div>)}
  </article>
}
