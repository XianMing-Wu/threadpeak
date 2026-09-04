import { useEffect, useRef, useState } from 'react'
import { AgentStatus } from '../components/AgentStatus'
import { EmptyStatus } from '../components/EmptyStatus'
import { Icon } from '../icons'
import { openRoute } from '../workspace/nav'
import { createMineRouteFromChat, getConversation, getRoute, saveConversation } from '../workspace/store'
import {
  followUpPathRun,
  getPathRun,
  pathLaunchAttachments,
  replyPathRun,
  retryPathRun,
  selectPathAnswer,
  startPathRun,
  type PathRunView,
} from './path-run-client.ts'
import { MarkdownMath } from '../lib/MarkdownMath'

const optionLetters = ['A', 'B', 'C', 'D'] as const

function publicPathErrorMessage(message: string | undefined): string {
  if (!message || /指定结构|该 Agent|schema|JSON 解析|模型没有返回 JSON/i.test(message)) {
    return '这次路线还没生成完整结果，请再试一次。'
  }
  return message
}

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
  if (!view.document || view.knowledgeCreated !== false) return ''
  const route = createMineRouteFromChat(query, [], conversationId, view.document as Parameters<typeof createMineRouteFromChat>[3])
  onRouteReady(route.id)
  return route.id
}

export function ChatRoutePanel(props: {
  conversationId: string
  query: string
  existingRouteId?: string
  thinkingDepth?: 'fast' | 'deep'
  onRouteReady: (routeId: string) => void
  onSender?: (handler: (text: string) => void) => void
}) {
  const existing = props.existingRouteId ? getRoute(props.existingRouteId) : undefined
  const [view, setView] = useState<PathRunView | null>(null)
  const [pending, setPending] = useState(false)
  const [replies, setReplies] = useState<{ user: string; assistant: string }[]>([])
  const [readyRouteId, setReadyRouteId] = useState(existing?.id ?? '')
  const launched = useRef('')

  const apply = (next: PathRunView) => {
    setView(next)
    if (next.runId) saveConversation(props.conversationId, { pathRunId: next.runId })
    if (next.status === 'published' && next.document) {
      try {
        const routeId = publish(next, props.query, props.conversationId, props.onRouteReady)
        if (routeId) setReadyRouteId(routeId)
      } catch {
        setReadyRouteId('')
      }
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
          error: { code: 'PROVIDER_INVALID', message: '这次路线制定找不到了。请重新开始。' },
        })
      })
      return
    }
    if (existing) return
    const key = `${props.conversationId}::${props.query}`
    if (launched.current === key) return
    launched.current = key
    const attachments = pathLaunchAttachments.get(props.conversationId)
    void run(() => startPathRun({ goal: props.query, thinkingDepth: props.thinkingDepth, ...(attachments ? { attachments } : {}) }))
  }, [existing, props.conversationId, props.query])

  useEffect(() => {
    props.onSender?.((text) => {
      if (!view) return
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
  const publishedTitle = existing?.title ?? view?.document?.metadata?.title ?? view?.route?.title ?? props.query
  const enterRouteId = readyRouteId || existing?.id || ''

  return <article className="route-clarification">
    {(pending || view?.status === 'running') && <AgentStatus items={[{
      label: view?.stage || '正在制定路线',
      done: false,
    }]}/>}
    {view?.status === 'failed' && <section className="route-ready-card" role="alert">
      <EmptyStatus
        kind="error"
        eyebrow="本次生成未完成"
        title="无法发布这条路线"
        body={publicPathErrorMessage(view.error?.message)}
        action="重试"
        onAction={() => view.runId && run(() => retryPathRun(view.runId))}
      />
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
            onClick={() => {
              const completes = current.questions.every((question) => (
                question.id === prompt.id || Boolean(current.selectedOptionIds[question.id])
              ))
              void run(async () => {
                if (completes) {
                  setView((currentView) => currentView
                    ? { ...currentView, status: 'running', stage: '正在生成学习路线' }
                    : currentView)
                }
                return selectPathAnswer(view.runId, prompt.id, option.id)
              })
            }}
          >
            <span className="option-letter">{optionLetters[index]}</span>
            <strong>{option.label}</strong>
          </button>
        ))}
      </div>
    </section>}
    {view?.status === 'published' && enterRouteId && <RouteReadyCard title={publishedTitle} routeId={enterRouteId}/>}
    {replies.map((item, index) => <div key={index}>
      <div className="query-user-bubble">{item.user}</div>
      <article className="chat-answer"><MarkdownMath source={item.assistant}/></article>
    </div>)}
  </article>
}
