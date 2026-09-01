import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { MAX_ANNOTATION_QUESTION_LENGTH, type SelectionAnchor } from '../session/ask-authors'
import { computePopupPosition } from '../session/popup-position'

export function AskAuthorsPrompt({
  selection,
  onCancel,
  onSubmit,
}: {
  selection: SelectionAnchor
  onCancel: () => void
  onSubmit: (question: string) => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const titleId = useId()
  const quoteId = useId()
  const [draft, setDraft] = useState('')
  const [box, setBox] = useState({ width: 0, height: 0 })

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const measure = () => {
      const width = dialog.offsetWidth
      const height = dialog.offsetHeight
      if (width > 0 && height > 0) setBox({ width, height })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(dialog)
    return () => observer.disconnect()
  }, [selection.text])

  useEffect(() => {
    textareaRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !dialogRef.current?.contains(event.target)) onCancel()
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onCancel()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onCancel])

  const question = draft.trim()
  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    if (!question) return
    onSubmit(question)
  }
  const onTextareaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || (!event.metaKey && !event.ctrlKey)) return
    event.preventDefault()
    submit()
  }

  const ready = box.width > 0 && box.height > 0
  const position = ready
    ? computePopupPosition(selection.rect, box, {
        left: 0,
        top: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      }, { sides: ['bottom', 'top'], gap: 10, safePadding: 12 })
    : null

  return (
    <div
      ref={dialogRef}
      className="ask-authors-prompt"
      role="dialog"
      aria-labelledby={titleId}
      aria-describedby={quoteId}
      style={{
        left: position ? position.left : -9999,
        top: position ? position.top : -9999,
        visibility: position ? 'visible' : 'hidden',
      }}
    >
      <div className="ask-authors-prompt__heading">
        <span className="ask-authors-prompt__mark" aria-hidden="true">问</span>
        <div>
          <strong id={titleId}>问博主</strong>
          <span>围绕所选原文输入你的问题</span>
        </div>
      </div>
      <blockquote id={quoteId} className="ask-authors-prompt__quote">{selection.text}</blockquote>
      <form className="ask-authors-prompt__form" onSubmit={submit}>
        <label className="ask-authors-prompt__sr-label" htmlFor={`${titleId}-input`}>输入想问博主的问题</label>
        <textarea
          ref={textareaRef}
          id={`${titleId}-input`}
          value={draft}
          maxLength={MAX_ANNOTATION_QUESTION_LENGTH}
          rows={3}
          placeholder="例如：这段结论在实际学习中应该怎么应用？"
          onChange={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={onTextareaKeyDown}
        />
        <div className="ask-authors-prompt__footer">
          <span>{draft.length}/{MAX_ANNOTATION_QUESTION_LENGTH} · ⌘/Ctrl + Enter 发送</span>
          <div className="ask-authors-prompt__actions">
            <button type="button" className="ask-authors-prompt__cancel" onClick={onCancel}>取消</button>
            <button type="submit" className="ask-authors-prompt__send" disabled={!question}>发送</button>
          </div>
        </div>
      </form>
    </div>
  )
}
