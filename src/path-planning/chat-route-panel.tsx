import { useEffect, useMemo, useRef } from 'react'
import { AgentStatus } from '../components/AgentStatus'
import { Icon } from '../icons'
import { useRuntimeSelector } from '../runtime/use-runtime-selector'
import { openRoute } from '../workspace/nav'
import { createMineRouteFromChat, getRoute } from '../workspace/store'
import { createPathGenerateSession } from './path-generate-session.ts'

const optionLetters = ['A', 'B', 'C', 'D'] as const

function RouteReadyCard(props: { title: string; routeId: string }) {
  return <section className="route-ready-card">
    <span><Icon name="check" size={20}/></span>
    <div>
      <small>路线已生成</small>
      <h2>{props.title}</h2>
      <p>这条路线来自已校验的生成结果。知识脉络仍要等第一次进入学习并看到首段讲解后才会同步生成。</p>
      <button type="button" onClick={() => { openRoute(props.routeId, 'chat'); location.hash = 'path-3d' }}>
        进入学习路线 <Icon name="arrow-right" size={16}/>
      </button>
    </div>
  </section>
}

export function ChatRoutePanel(props: {
  conversationId: string
  query: string
  existingRouteId?: string
  onRouteReady: (routeId: string) => void
}) {
  const existing = props.existingRouteId ? getRoute(props.existingRouteId) : undefined
  const session = useMemo(() => createPathGenerateSession({
    fetch: (input, init) => fetch(input, init),
    now: () => performance.now(),
  }), [])
  const view = useRuntimeSelector(session.store, (next) => next)
  const published = useRef(Boolean(existing))

  useEffect(() => {
    if (existing) return
    session.submitNewGoal(props.query)
    return () => session.abort() // keep the store; teardown() would freeze updates after StrictMode cleanup
  }, [existing, props.query, session])
  useEffect(() => {
    if (published.current || view.runState !== 'ready' || !view.document) return
    const route = createMineRouteFromChat(
      props.query,
      view.clarificationHistory.map((item) => item.option.label),
      props.conversationId,
      view.document,
    )
    published.current = true
    props.onRouteReady(route.id)
  }, [props.conversationId, props.onRouteReady, props.query, view.clarificationHistory, view.document, view.runState])

  if (existing) {
    return <article className="route-clarification"><RouteReadyCard title={existing.title} routeId={existing.id}/></article>
  }

  const prompt = view.clarification
  const readyTitle = view.document ? (getRoute(view.document.id)?.title ?? view.document.metadata.title) : ''

  return <article className="route-clarification">
    {view.runState === 'pending' && <AgentStatus items={[{ label: view.status, done: false }]}/>}
    {view.runState === 'error' && <section className="route-ready-card" role="alert">
      <div>
        <small>本次生成未完成</small>
        <h2>无法发布这条路线</h2>
        <p>{view.error}</p>
        <button type="button" onClick={() => session.submitNewGoal(props.query)}>重试</button>
      </div>
    </section>}
    {prompt && <section className="clarification-card" data-question={prompt.step}>
      <small>第 {prompt.step} 题 · 共 {prompt.total} 题</small>
      <h2>{prompt.question}</h2>
      <div className="clarification-options">
        {prompt.options.map((option, index) => (
          <button
            key={option.id}
            type="button"
            className={view.selectedOptionId === option.id ? 'is-selected' : ''}
            disabled={view.runState === 'pending'}
            onClick={() => session.selectOption(option.id)}
          >
            <span className="option-letter">{optionLetters[index]}</span>
            <strong>{option.label}</strong>
          </button>
        ))}
      </div>
      <button type="button" disabled={!view.selectedOptionId || view.runState === 'pending'} onClick={() => session.continueClarification(props.query)}>
        {prompt.step === prompt.total ? '生成完整路径' : '下一题'}
      </button>
    </section>}
    {view.runState === 'ready' && view.document && <RouteReadyCard title={readyTitle} routeId={view.document.id}/>}
  </article>
}
