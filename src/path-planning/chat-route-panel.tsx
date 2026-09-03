import { useEffect, useRef, useState } from 'react'
import { AgentStatus } from '../components/AgentStatus'
import { Icon } from '../icons'
import { openRoute } from '../workspace/nav'
import { createMineRouteFromChat, getConversation, getRoute, saveConversation } from '../workspace/store'
import {
  commitPathAnswers,
  followUpPathRun,
  getPathRun,
  pathLaunchAttachments,
  replyPathRun,
  retryPathRun,
  selectPathAnswer,
  startPathRun,
  type PathRunView,
} from './path-run-client.ts'
import type { AssistantMode } from '../assistant-mode'
import { MarkdownMath } from '../lib/MarkdownMath'

const optionLetters = ['A', 'B', 'C', 'D'] as const

function RouteReadyCard(props: { title: string; routeId: string }) {
  return <section className="route-ready-card">
    <span><Icon name="check" size={20}/></span>
    <div>
      <small>路线已生成</small>
      <h2>{props.title}</h2>
      <p>这条路线来自已校验的生成结果。知识脉络仍要等第一次进入学习并看到首段讲解后才会同步生成。</p>
      <button type="button" onClick={() => { openRoute(props.routeId, 'paths'); location.hash = 'path-3d' }}>
        进入学习路线 <Icon name="arrow-right" size={16}/>
      </button>
    </div>
  </section>
}

function publish(view: PathRunView, query: string, conversationId: string, onRouteReady: (id: string) => void) {
  if (!view.document || view.knowledgeCreated !== false) return
  const route = createMineRouteFromChat(query, [], conversationId, view.document as Parameters<typeof createMineRouteFromChat>[3])
  onRouteReady(route.id)
}

export function ChatRoutePanel(props: {
  conversationId: string
  query: string
  existingRouteId?: string
  onRouteReady: (routeId: string) => void
  onSender?: (handler: (text: string, mode: AssistantMode) => void) => void
}) {
  const existing = props.existingRouteId ? getRoute(props.existingRouteId) : undefined
  const [view, setView] = useState<PathRunView | null>(null)
  const [pending, setPending] = useState(false)
  const [replies, setReplies] = useState<{ user: string; assistant: string }[]>([])
  const launched = useRef('')

  const apply = (next: PathRunView) => {
    setView(next)
    if (next.runId) saveConversation(props.conversationId, { pathRunId: next.runId })
    if (next.status === 'published' && next.document) {
      publish(next, props.query, props.conversationId, props.onRouteReady)
    }
  }

  const run = async (work: () => Promise<PathRunView>) => {
    setPending(true)
    try {
      apply(await work())
    } catch (error) {
      setView({
        runId: view?.runId ?? '',
        goal: props.query,
        status: 'failed',
        stage: 'failed',
        questionSets: view?.questionSets ?? [],
        knowledgeCreated: false,
        error: { code: 'PROVIDER_UNAVAILABLE', message: error instanceof Error ? error.message : '路线服务不可用。' },
      })
    } finally {
      setPending(false)
    }
  }

  useEffect(() => {
    const stored = getConversation(props.conversationId)
    if (stored?.pathRunId) {
      const runId = stored.pathRunId
      const key = `restore:${runId}`
      if (launched.current === key) return
      launched.current = key
      void getPathRun(runId).then(apply).catch(() => {
        launched.current = `missing:${runId}`
        if (existing) return
        setView({
          runId,
          goal: props.query,
          status: 'failed',
          stage: 'failed',
          questionSets: [],
          knowledgeCreated: false,
          error: { code: 'PROVIDER_INVALID', message: '找不到这次路线制定。记录丢了只显示失败，不会重新生成。' },
        })
      })
      return
    }
    if (existing) return
    const key = `${props.conversationId}::${props.query}`
    if (launched.current === key) return
    launched.current = key
    const attachments = pathLaunchAttachments.get(props.conversationId)
    void run(() => startPathRun({ goal: props.query, ...(attachments ? { attachments } : {}) }))
  }, [existing, props.conversationId, props.query])

  useEffect(() => {
    props.onSender?.((text, mode) => {
      if (!view) return
      if (mode === 'route' && view.status === 'published') {
        setReplies([])
        void run(() => startPathRun({ goal: text }))
        return
      }
      if (view.status === 'awaiting_answers') {
        void run(() => followUpPathRun(view.runId, text))
        return
      }
      if (view.status === 'published') {
        void run(async () => {
          const next = await replyPathRun(view.runId, text)
          if (next.reply) setReplies((current) => [...current, { user: text, assistant: next.reply ?? '' }])
          return next
        })
      }
    })
  }, [props, view])

  if (existing && !view) {
    return <article className="route-clarification"><RouteReadyCard title={existing.title} routeId={existing.id}/></article>
  }

  const active = view?.questionSets.filter((item) => item.status === 'active') ?? []
  const superseded = view?.questionSets.filter((item) => item.status === 'superseded') ?? []
  const current = active[0]
  const unanswered = current?.questions.filter((question) => !current.selectedOptionIds[question.id]) ?? []
  const prompt = unanswered[0] ?? current?.questions[0]
  const publishedTitle = view?.document?.metadata?.title ?? view?.route?.title ?? props.query
  const publishedId = view?.document?.id

  return <article className="route-clarification">
    {(pending || view?.status === 'running') && <AgentStatus items={[{ label: view?.stage || '正在制定路线', done: false }]}/>}
    {view?.status === 'failed' && <section className="route-ready-card" role="alert">
      <div>
        <small>本次生成未完成</small>
        <h2>无法发布这条路线</h2>
        <p>{view.error?.message}</p>
        <button type="button" onClick={() => view.runId && run(() => retryPathRun(view.runId))}>重试</button>
      </div>
    </section>}
    {superseded.map((set) => <section key={`old-${set.round}`} className="clarification-card is-superseded" aria-disabled="true">
      <small>第 {set.round} 轮 · 已替换</small>
      {set.questions.map((question) => <div key={question.id}>
        <h2>{question.prompt}</h2>
        <div className="clarification-options">
          {question.options.map((option, index) => (
            <button key={option.id} type="button" disabled className={set.selectedOptionIds[question.id] === option.id ? 'is-selected' : ''}>
              <span className="option-letter">{optionLetters[index]}</span>
              <strong>{option.label}</strong>
            </button>
          ))}
        </div>
      </div>)}
    </section>)}
    {view?.followUpMessage && view.status === 'awaiting_answers' && <article className="chat-answer"><MarkdownMath source={view.followUpMessage}/></article>}
    {prompt && view?.status === 'awaiting_answers' && <section className="clarification-card" data-question={current.round}>
      <small>第 {current.round} 轮 · 最多 3 轮</small>
      <h2>{prompt.prompt}</h2>
      <div className="clarification-options">
        {prompt.options.map((option, index) => (
          <button
            key={option.id}
            type="button"
            className={current.selectedOptionIds[prompt.id] === option.id ? 'is-selected' : ''}
            disabled={pending}
            onClick={() => run(() => selectPathAnswer(view.runId, prompt.id, option.id))}
          >
            <span className="option-letter">{optionLetters[index]}</span>
            <strong>{option.label}</strong>
          </button>
        ))}
      </div>
      {current.questions.every((question) => current.selectedOptionIds[question.id]) && <button
        type="button"
        disabled={pending}
        onClick={() => run(() => commitPathAnswers(view.runId))}
      >
        生成完整路径
      </button>}
    </section>}
    {view?.status === 'published' && publishedId && <RouteReadyCard title={publishedTitle} routeId={publishedId}/>}
    {replies.map((item, index) => <div key={index}>
      <div className="query-user-bubble">{item.user}</div>
      <article className="chat-answer"><MarkdownMath source={item.assistant}/></article>
    </div>)}
  </article>
}
