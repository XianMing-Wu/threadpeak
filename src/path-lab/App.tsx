import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useRuntimeSelector } from '../runtime/use-runtime-selector'
import { GoalInput } from './GoalInput'
import { ClarificationCard } from './ClarificationCard'
import { Path3DErrorBoundary } from './Path3DErrorBoundary'
import type { PathLabSession } from './path-lab-session'
import type { LearningPathDocument } from 'liu-kanshan-learning-path-3d'

const LearningPath3DView = lazy(async () => {
  const module = await import('../components/Path3D')
  return { default: module.LearningPath3DView }
})

type EvidenceItem = Readonly<{
  id: string
  title: string
  summary: string
  href?: string
  tags: readonly string[]
}>

function asInspectableHref(href: string): string | undefined {
  try {
    const url = new URL(href, location.href)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined
  } catch {
    return undefined
  }
}

function evidenceItems(document: LearningPathDocument): EvidenceItem[] {
  const cards = new Map(document.data.cards.map((card) => [card.id, card]))
  const actions = new Map(document.data.actions.map((action) => [action.id, action]))
  const resources = new Map(document.data.resources.map((resource) => [resource.id, resource]))

  return document.structure.concepts.map((concept) => {
    const card = cards.get(concept.cardRef)
    const action = actions.get(concept.actionRef)
    const resource = action ? resources.get(action.resourceId) : undefined
    return {
      id: concept.id,
      title: card?.title ?? concept.id,
      summary: card?.summary ?? '该概念已进入最小学习路径。',
      href: resource ? asInspectableHref(resource.href) : undefined,
      tags: card?.tags ?? [],
    }
  })
}

function qualityScoreLabel(score: number): string {
  const normalized = score >= 0 && score <= 1 ? score * 100 : score
  return `${Math.round(normalized)} 分`
}

function elapsedLabel(milliseconds: number): string {
  if (milliseconds < 1000) return '< 1 秒'
  return `${(milliseconds / 1000).toFixed(1)} 秒`
}

export function PathLabApp(props: { session: PathLabSession }) {
  const session = props.session
  const view = useRuntimeSelector(session.store, (snapshot) => snapshot)
  const [goal, setGoal] = useState('')
  const items = useMemo(() => view.document ? evidenceItems(view.document) : [], [view.document])
  const pending = view.runState === 'pending'
  const diagnostics = view.attemptDiagnostics ?? view.publishedDiagnostics

  useEffect(() => {
    if (!pending) return
    const timer = window.setInterval(() => session.tickElapsed(), 1000)
    return () => window.clearInterval(timer)
  }, [pending, session])

  useEffect(() => () => session.abort(), [session])

  const changeGoal = (value: string) => {
    setGoal(value)
    session.changeGoal(value)
  }

  return <div className="path-lab" data-run-state={view.runState}>
    <header className="path-lab-input-panel">
      <div className="path-lab-heading">
        <span>ThreadPeak · 路径算法实验台</span>
        <h1>从目标生成 3D 知识脉络</h1>
        <p>这里只保留目标输入、生成状态、路径与其证据门禁。</p>
      </div>
      <GoalInput
        value={goal}
        onChange={changeGoal}
        onSubmit={(rawGoal) => session.submitNewGoal(rawGoal)}
        pending={pending}
        onAbort={() => session.abort()}
        error={view.error}
      />
      <div className="path-lab-status">
        <i aria-hidden="true" />
        <span role="status" aria-live="polite" aria-atomic="true">{view.status}</span>
        {(pending || view.runState === 'ready') && <time aria-hidden="true">{elapsedLabel(view.elapsedMs)}</time>}
      </div>
    </header>

    <main className="path-lab-workspace">
      <section className="path-lab-canvas" aria-label="生成的 3D 知识脉络">
        {view.clarification && <ClarificationCard
          prompt={view.clarification}
          history={view.clarificationHistory}
          selectedOptionId={view.selectedOptionId}
          pending={pending}
          onSelect={(optionId) => session.selectOption(optionId)}
          onContinue={() => session.continueClarification(goal.trim())}
          onBack={() => session.backClarification()}
          onRestart={() => session.restartClarification()}
        />}
        {view.document ? <>
          <div className="path-lab-document-title">
            <small>RENDERER V1</small>
            <strong>{view.document.metadata.title}</strong>
            {view.document.metadata.description && <span>{view.document.metadata.description}</span>}
          </div>
          <Path3DErrorBoundary resetKey={view.document.id}>
            <Suspense fallback={<div className="path-lab-loading-3d" role="status"><i aria-hidden="true" />正在加载 3D 运行时…</div>}>
              <LearningPath3DView
                document={view.document}
                ariaLabel={`${view.document.metadata.title}的 3D 知识脉络`}
                instanceIdPrefix="threadpeak-path-lab"
              />
            </Suspense>
          </Path3DErrorBoundary>
          {pending && <div className="path-lab-refreshing" role="status"><i aria-hidden="true" />正在生成新版本，当前路径仍可浏览</div>}
        </> : <div className="path-lab-empty">
          <div className="path-lab-empty-graph" aria-hidden="true"><i /><i /><i /><i /></div>
          <strong>3D 路径将在这里出现</strong>
          <span>输入具体终点后，算法会先建立需求、证据和载体，再投影为渲染文档。</span>
        </div>}
      </section>

      {(view.document || diagnostics) && <aside className="path-lab-inspector" aria-label="路径证据与质量摘要">
        <section className="path-lab-quality">
          <header><span>{view.attemptDiagnostics ? '本次尝试质量' : '质量摘要'}</span><b data-passed={diagnostics?.passed === true}>{diagnostics?.passed === true ? '已通过' : '未通过 · 未发布'}</b></header>
          {view.document && <dl aria-label="当前已发布路径结构">
            <div><dt>载体</dt><dd>{view.document.structure.subjects.length}</dd></div>
            <div><dt>最终概念</dt><dd>{view.document.structure.concepts.length}</dd></div>
            <div><dt>证据入口</dt><dd>{view.document.data.resources.length}</dd></div>
            <div><dt>分支 / 合流</dt><dd>{view.document.structure.flowGroups.length}</dd></div>
          </dl>}
          <ul>
            <li><span>质量门禁</span><strong>{diagnostics ? qualityScoreLabel(diagnostics.qualityScore) : '未通过'}</strong></li>
            <li><span>确定性不变量</span><strong>{diagnostics ? diagnostics.invariantCount : 0}</strong></li>
            <li><span>服务耗时</span><strong>{diagnostics ? elapsedLabel(diagnostics.totalMs) : elapsedLabel(view.elapsedMs)}</strong></li>
            <li><span>生成模式</span><strong>{diagnostics?.degraded ? '降级输出' : '完整输出'}</strong></li>
          </ul>
          {diagnostics?.sourceCounts.length ? <div className="path-lab-source-counts">
            {diagnostics.sourceCounts.map((source) => <span key={source.label}>{source.label}<b>{source.value}</b></span>)}
          </div> : null}
          {diagnostics && <div className="path-lab-source-counts">
            <span>Provider 调用<b>{Math.max(0, Math.round(diagnostics.providerCallCount))}</b></span>
            <span>修复轮次<b>{diagnostics.repairRounds}</b></span>
          </div>}
          {diagnostics?.degradationLabels.length ? <div className="path-lab-degradation">
            <span>降级原因</span>{diagnostics.degradationLabels.map((label) => <em key={label}>{label}</em>)}
          </div> : null}
          {diagnostics?.qualityIssueLabels.length ? <div className="path-lab-quality-issues" role="status">
            <span>阻断原因</span>
            <ul>{diagnostics.qualityIssueLabels.slice(0, 6).map((label) => <li key={label}>{label}</li>)}</ul>
          </div> : null}
        </section>

        {view.document && <section className="path-lab-evidence">
          <header><span>概念与证据</span><b>{items.length}</b></header>
          <div>
            {items.map((item, index) => <article key={item.id}>
              <i>{String(index + 1).padStart(2, '0')}</i>
              <div>
                <strong>{item.title}</strong>
                <p>{item.summary}</p>
                {item.tags.length > 0 && <small>{item.tags.slice(0, 3).join(' · ')}</small>}
              </div>
              {item.href && <a href={item.href} target="_blank" rel="noreferrer" aria-label={`打开“${item.title}”的证据`}>↗</a>}
            </article>)}
          </div>
        </section>}
      </aside>}
    </main>
  </div>
}
