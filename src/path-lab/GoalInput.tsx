import { useRef, type CompositionEvent, type FormEvent, type KeyboardEvent } from 'react'
import { shouldSubmitGoalFromKey } from './inputPolicy'

export type GoalInputProps = Readonly<{
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void | Promise<void>
  pending?: boolean
  onAbort?: () => void
  error?: string
  maxLength?: number
}>

export function GoalInput({
  value,
  onChange,
  onSubmit,
  pending = false,
  onAbort,
  error,
  maxLength = 1200,
}: GoalInputProps) {
  const composingRef = useRef(false)
  const trimmedValue = value.trim()

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    if (pending || !trimmedValue) return
    void onSubmit(trimmedValue)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!shouldSubmitGoalFromKey({
      key: event.key,
      shiftKey: event.shiftKey,
      isComposing: composingRef.current || event.nativeEvent.isComposing,
      keyCode: event.nativeEvent.keyCode,
    })) return
    event.preventDefault()
    submit()
  }

  const startComposition = () => {
    composingRef.current = true
  }

  const endComposition = (_event: CompositionEvent<HTMLTextAreaElement>) => {
    composingRef.current = false
  }

  return <form className={`goal-input input-motion-frame${pending ? ' is-pending' : ''}`} onSubmit={submit} aria-busy={pending}>
    <span className="input-motion-glow" aria-hidden="true"><span className="ambient-glow" /></span>
    <label htmlFor="path-lab-goal">目标</label>
    <textarea
      id="path-lab-goal"
      value={value}
      maxLength={maxLength}
      rows={3}
      disabled={pending}
      placeholder="例如：我会 JavaScript，想从零做出一个可运行的 Three.js 软件渲染器"
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={handleKeyDown}
      onCompositionStart={startComposition}
      onCompositionEnd={endComposition}
      aria-describedby={error ? 'path-lab-goal-help path-lab-goal-error' : 'path-lab-goal-help'}
      aria-invalid={Boolean(error)}
    />
    <div className="goal-input-footer">
      <span id="path-lab-goal-help">Enter 生成 · Shift + Enter 换行</span>
      <span className="goal-input-actions">
        <small>{value.length}/{maxLength}</small>
        {pending
          ? <button type="button" className="goal-input-abort" onClick={onAbort}>停止</button>
          : <button type="submit" className="goal-input-submit" disabled={!trimmedValue}>生成路径</button>}
      </span>
    </div>
    {error && <p id="path-lab-goal-error" role="alert">{error}</p>}
  </form>
}
