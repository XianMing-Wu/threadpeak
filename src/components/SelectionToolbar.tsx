import { useLayoutEffect, useRef, useState } from 'react'
import { computePopupPosition } from '../session/popup-position'
import type { SelectionAnchor } from '../session/ask-authors'

export function SelectionToolbar({
  selection,
  onAddToChat,
  onAskAuthors,
}: {
  selection: SelectionAnchor
  onAddToChat: () => void
  onAskAuthors: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ width: 0, height: 0 })

  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    const measure = () => setBox({ width: node.offsetWidth, height: node.offsetHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [selection.text])

  const ready = box.width > 0
  const position = ready
    ? computePopupPosition(selection.rect, box, {
        left: 0,
        top: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      }, { sides: ['top', 'bottom'], gap: 8, safePadding: 12 })
    : null

  return (
    <div
      ref={ref}
      className="sel-toolbar"
      role="toolbar"
      aria-label="划选操作"
      aria-orientation="horizontal"
      style={{
        left: position ? position.left : -9999,
        top: position ? position.top : -9999,
        visibility: position ? 'visible' : 'hidden',
      }}
    >
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={onAddToChat}>添加到对话</button>
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={onAskAuthors}>问博主</button>
    </div>
  )
}
