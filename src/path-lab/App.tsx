import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { LearningPathDocument } from 'liu-kanshan-learning-path-3d'
import { GoalInput } from './GoalInput'
import {
  parseGenerationResponse,
  PublicPathLabError,
  readSafeServiceFailure,
  type ClarificationAnswer,
  type ClarificationOption,
  type ClarificationPrompt,
  type PathDiagnosticsView,
} from './contracts'
import { ClarificationCard, type ClarificationHistoryItem } from './ClarificationCard'
import { Path3DErrorBoundary } from './Path3DErrorBoundary'

type RunState = 'idle' | 'clarifying' | 'pending' | 'ready' | 'aborted' | 'error'

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

export function PathLabApp() {
  const [goal, setGoal] = useState('')
  const [runState, setRunState] = useState<RunState>('idle')
  const [status, setStatus] = useState('等待输入一个可观察、可验证的学习目标')
  const [error, setError] = useState('')
  const [document, setDocument] = useState<LearningPathDocument>()
  const [publishedDiagnostics, setPublishedDiagnostics] = useState<PathDiagnosticsView>()
  const [attemptDiagnostics, setAttemptDiagnostics] = useState<PathDiagnosticsView>()
  const [clarification, setClarification] = useState<ClarificationPrompt>()
  const [clarificationGoal, setClarificationGoal] = useState('')
  const [clarificationAnswers, setClarificationAnswers] = useState<ClarificationAnswer[]>([])
  const [clarificationHistory, setClarificationHistory] = useState<ClarificationHistoryItem[]>([])
  const [selectedOptionId, setSelectedOptionId] = useState<string>()
  const [elapsedMs, setElapsedMs] = useState(0)
  const requestRef = useRef<{ id: number; controller: AbortController; startedAt: number } | undefined>(undefined)
  const requestIdRef = useRef(0)
  const items = useMemo(() => document ? evidenceItems(document) : [], [document])
  const pending = runState === 'pending'
  const diagnostics = attemptDiagnostics ?? publishedDiagnostics

  useEffect(() => {
    if (!pending) return
    const timer = window.setInterval(() => {
      const request = requestRef.current
      if (request) setElapsedMs(performance.now() - request.startedAt)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [pending])

  useEffect(() => () => requestRef.current?.controller.abort(), [])

  const abort = () => {
    const request = requestRef.current
    if (!request) return
    request.controller.abort()
    requestRef.current = undefined
    setRunState('aborted')
    setStatus('已停止本次生成；目标草稿仍保留，可修改后重试')
  }

  const resetClarification = () => {
    setClarification(undefined)
    setClarificationGoal('')
    setClarificationAnswers([])
    setClarificationHistory([])
    setSelectedOptionId(undefined)
  }

  const changeGoal = (value: string) => {
    setGoal(value)
    if (clarification && value.trim() !== clarificationGoal) {
      resetClarification()
      setRunState(document ? 'ready' : 'idle')
      setStatus(document ? '当前路径仍可浏览；修改目标后可生成新版本' : '等待生成新的学习目标')
      setError('')
    }
  }

  const generate = async (
    rawGoal: string,
    answers: readonly ClarificationAnswer[] = [],
    transition?: Readonly<{ prompt: ClarificationPrompt; option: ClarificationOption }>,
  ) => {
    requestRef.current?.controller.abort()
    requestIdRef.current += 1
    const id = requestIdRef.current
    const controller = new AbortController()
    const startedAt = performance.now()
    requestRef.current = { id, controller, startedAt }
    setRunState('pending')
    setStatus(answers.length > 0 ? '选择已确认，正在生成完整路径…' : '正在判断目标是否需要校准…')
    setError('')
    setAttemptDiagnostics(undefined)
    setElapsedMs(0)

    try {
      const response = await fetch('/api/paths/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ raw_goal: rawGoal, clarification_answers: answers }),
        signal: controller.signal,
      })
      if (!response.ok) {
        const failure = await readSafeServiceFailure(response)
        if (requestRef.current?.id !== id) return
        if (failure.diagnostics) setAttemptDiagnostics(failure.diagnostics)
        if (failure.clarification) {
          if (transition && failure.clarification.questionId !== transition.prompt.questionId) {
            setClarificationHistory((current) => [
              ...current.filter((item) => item.prompt.questionId !== transition.prompt.questionId),
              transition,
            ])
          }
          setClarification(failure.clarification)
          setClarificationGoal(rawGoal)
          setSelectedOptionId(
            answers.find((answer) => answer.question_id === failure.clarification?.questionId)?.option_id,
          )
          setElapsedMs(performance.now() - startedAt)
          setRunState('clarifying')
          setStatus(`请完成第 ${failure.clarification.step} 题；答完最多 ${failure.clarification.total} 题后立即生成`)
          setError('')
          return
        }
        throw new PublicPathLabError(failure.message)
      }

      let payload: unknown
      try {
        payload = await response.json()
      } catch {
        throw new PublicPathLabError('生成服务没有返回有效 JSON')
      }
      const result = parseGenerationResponse(payload)
      if (requestRef.current?.id !== id) return
      setAttemptDiagnostics(result.diagnostics)
      if (result.diagnostics.passed !== true) {
        const issueSummary = result.diagnostics.qualityIssueCodes.length
          ? `：${result.diagnostics.qualityIssueLabels.slice(0, 3).join('、')}`
          : result.diagnostics.qualityIssueCount
            ? `（${result.diagnostics.qualityIssueCount} 项问题）`
            : ''
        throw new PublicPathLabError(`质量门禁未通过${issueSummary}；未发布新路径，上一版路径已保留`)
      }

      setDocument(result.rendererDocument)
      setPublishedDiagnostics(result.diagnostics)
      setAttemptDiagnostics(undefined)
      setElapsedMs(performance.now() - startedAt)
      setRunState('ready')
      setStatus(`路径已生成：${result.rendererDocument.structure.subjects.length} 个载体，${result.rendererDocument.structure.concepts.length} 个最终概念`)
      resetClarification()
    } catch (cause: unknown) {
      if (controller.signal.aborted || (cause instanceof DOMException && cause.name === 'AbortError')) return
      if (requestRef.current?.id !== id) return
      setRunState('error')
      setStatus('本次生成未完成')
      setError(cause instanceof PublicPathLabError ? cause.message : '无法连接本地路径生成服务，请确认服务已启动后重试')
    } finally {
      if (requestRef.current?.id === id) requestRef.current = undefined
    }
  }

  const submitNewGoal = (rawGoal: string) => {
    resetClarification()
    void generate(rawGoal)
  }

  const continueClarification = () => {
    if (!clarification || !selectedOptionId || pending) return
    const option = clarification.options.find((item) => item.id === selectedOptionId)
    if (!option) return
    const nextAnswers = [
      ...clarificationAnswers.filter((answer) => answer.question_id !== clarification.questionId),
      { question_id: clarification.questionId, option_id: option.id },
    ]
    setClarificationAnswers(nextAnswers)
    void generate(clarificationGoal || goal.trim(), nextAnswers, { prompt: clarification, option })
  }

  const backClarification = () => {
    const prior = clarificationHistory.at(-1)
    if (!prior || pending) return
    const remaining = clarificationHistory.slice(0, -1)
    setClarificationHistory(remaining)
    setClarificationAnswers(
      remaining.map((item) => ({
        question_id: item.prompt.questionId,
        option_id: item.option.id,
      })),
    )
    setClarification(prior.prompt)
    setSelectedOptionId(prior.option.id)
    setRunState('clarifying')
    setStatus(`返回第 ${prior.prompt.step} 题，可重新选择后继续`)
    setError('')
  }

  const restartClarification = () => {
    resetClarification()
    setRunState(document ? 'ready' : 'idle')
    setStatus('请修改目标；原草稿已保留')
    setError('')
  }

  return <div className="path-lab" data-run-state={runState}>
    <header className="path-lab-input-panel">
      <div className="path-lab-heading">
        <span>ThreadPeak · 路径算法实验台</span>
        <h1>从目标生成 3D 知识脉络</h1>
        <p>这里只保留目标输入、生成状态、路径与其证据门禁。</p>
      </div>
      <GoalInput
        value={goal}
        onChange={changeGoal}
        onSubmit={submitNewGoal}
        pending={pending}
        onAbort={abort}
        error={error}
      />
      <div className="path-lab-status">
        <i aria-hidden="true" />
        <span role="status" aria-live="polite" aria-atomic="true">{status}</span>
        {(pending || runState === 'ready') && <time aria-hidden="true">{elapsedLabel(elapsedMs)}</time>}
      </div>
    </header>

    <main className="path-lab-workspace">
      <section className="path-lab-canvas" aria-label="生成的 3D 知识脉络">
        {clarification && <ClarificationCard
          prompt={clarification}
          history={clarificationHistory}
          selectedOptionId={selectedOptionId}
          pending={pending}
          onSelect={setSelectedOptionId}
          onContinue={continueClarification}
          onBack={backClarification}
          onRestart={restartClarification}
        />}
        {document ? <>
          <div className="path-lab-document-title">
            <small>RENDERER V1</small>
            <strong>{document.metadata.title}</strong>
            {document.metadata.description && <span>{document.metadata.description}</span>}
          </div>
          <Path3DErrorBoundary resetKey={document.id}>
            <Suspense fallback={<div className="path-lab-loading-3d" role="status"><i aria-hidden="true" />正在加载 3D 运行时…</div>}>
              <LearningPath3DView
                document={document}
                ariaLabel={`${document.metadata.title}的 3D 知识脉络`}
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

      {(document || diagnostics) && <aside className="path-lab-inspector" aria-label="路径证据与质量摘要">
        <section className="path-lab-quality">
          <header><span>{attemptDiagnostics ? '本次尝试质量' : '质量摘要'}</span><b data-passed={diagnostics?.passed === true}>{diagnostics?.passed === true ? '已通过' : '未通过 · 未发布'}</b></header>
          {document && <dl aria-label="当前已发布路径结构">
            <div><dt>载体</dt><dd>{document.structure.subjects.length}</dd></div>
            <div><dt>最终概念</dt><dd>{document.structure.concepts.length}</dd></div>
            <div><dt>证据入口</dt><dd>{document.data.resources.length}</dd></div>
            <div><dt>分支 / 合流</dt><dd>{document.structure.flowGroups.length}</dd></div>
          </dl>}
          <ul>
            <li><span>质量门禁</span><strong>{diagnostics ? qualityScoreLabel(diagnostics.qualityScore) : '未通过'}</strong></li>
            <li><span>确定性不变量</span><strong>{diagnostics ? diagnostics.invariantCount : 0}</strong></li>
            <li><span>服务耗时</span><strong>{diagnostics ? elapsedLabel(diagnostics.totalMs) : elapsedLabel(elapsedMs)}</strong></li>
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

        {document && <section className="path-lab-evidence">
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
