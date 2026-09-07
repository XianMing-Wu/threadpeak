import { useEffect, useRef, useState, type ReactNode, type SVGProps } from 'react'
import { pillTitle, thoughtForDisplay, type ProcessStep } from '../process-trace'
import './process-trace.css'

function MiniIcon({ children, size = 12, ...props }: SVGProps<SVGSVGElement> & { size?: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  )
}

function StepIcon({ kind }: { kind: ProcessStep['kind'] }) {
  if (kind === 'think') {
    return <MiniIcon><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></MiniIcon>
  }
  if (kind === 'search') {
    return <MiniIcon><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></MiniIcon>
  }
  if (kind === 'confirm') {
    return <MiniIcon><path d="m4 12 5 5L20 6"/></MiniIcon>
  }
  return <MiniIcon><path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6"/></MiniIcon>
}

export function ToolPill({
  step,
  trailing,
  running,
}: {
  step: ProcessStep
  trailing?: ReactNode
  running?: boolean
}) {
  return (
    <div className={running ? 'tp-pill running-step' : 'tp-pill'}>
      <StepIcon kind={step.kind} />
      <b>{pillTitle(step)}</b>
      {step.extra ? <span className="extra">{step.extra}</span> : null}
      {trailing}
    </div>
  )
}

/** Read-only answer history uses the same visual atom as workflow steps. */
export function ConfirmedQuestion({ question, answer }: { question: string; answer?: string }) {
  return <details className="tp-think clarification-confirmed">
    <summary>
      <ToolPill step={{ id: question, kind: 'confirm', status: 'done', title: answer ? '已选择' : '问题已更新', extra: answer ?? question }} trailing={<MiniIcon size={10}><path d="m6 9 6 6 6-6" /></MiniIcon>} />
    </summary>
    <div className="tp-thought"><strong>{question}</strong><p>{answer ?? '已根据你的补充更新问题'}</p></div>
  </details>
}

function ThinkStep({ step }: { step: ProcessStep }) {
  const running = step.status === 'running'
  const rawThought = step.thought?.trim() ?? ''
  const thought = thoughtForDisplay(rawThought) || (running && rawThought ? '正在整理路线结构…' : '')
  const bodyRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(running)
  useEffect(() => {
    setOpen(running)
  }, [running])
  useEffect(() => {
    const node = bodyRef.current
    if (node && running) node.scrollTop = node.scrollHeight
  }, [thought, running])
  return (
    <details
      className="tp-think"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <ToolPill
          step={step}
          running={running}
          trailing={<MiniIcon size={9}><path d="m6 9 6 6 6-6"/></MiniIcon>}
        />
      </summary>
      {thought ? <div className="tp-thought" ref={bodyRef}>{thought}</div> : null}
    </details>
  )
}

function ToolStep({ step }: { step: ProcessStep }) {
  const running = step.status === 'running'
  return (
    <div className={running ? 'tp-tool running' : 'tp-tool'}>
      <ToolPill
        step={step}
        running={running}
        trailing={running ? <span className="tp-spinner" aria-hidden="true" /> : null}
      />
      {running ? <span className="tp-step-progress" aria-hidden="true" /> : null}
    </div>
  )
}

export function PonderMark() {
  return (
    <span className="tp-ponder-mark" aria-hidden="true">
      <img src="/ponder-mark.png" alt="" width={13} height={13} />
    </span>
  )
}

export function ProcessTrace({
  steps,
  pondering = '处理中...',
}: {
  steps: readonly ProcessStep[]
  pondering?: string
}) {
  if (steps.length === 0) return null
  const running = steps.some((step) => step.status === 'running')
  return (
    <div className="tp-process" role="status" aria-live="polite">
      {steps.map((step) => (
        step.kind === 'think'
          ? <ThinkStep key={step.id} step={step} />
          : <ToolStep key={step.id} step={step} />
      ))}
      {running ? <div className="tp-pondering"><PonderMark />{pondering}</div> : null}
    </div>
  )
}
