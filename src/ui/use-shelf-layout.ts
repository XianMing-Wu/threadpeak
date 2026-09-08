import { useLayoutEffect, type RefObject } from 'react'

/** Quantize the opening to whole books (at most four), while reserving both end caps. */
export function useShelfLayout(ref: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const cabinet = ref.current, parent = cabinet?.parentElement
    if (!cabinet || !parent) return
    const layout = () => {
      const styles = getComputedStyle(cabinet)
      const value = (name: string) => parseFloat(styles.getPropertyValue(name))
      const book = value('--shelf-book-width'), gap = value('--shelf-gap')
      const frame = 2 * (value('--shelf-cap') + value('--shelf-inset') + value('--shelf-pad-x'))
      const available = parent.clientWidth
      const count = Math.max(1, Math.min(4, Math.floor((available - frame + gap) / (book + gap))))
      cabinet.style.width = `${Math.min(available, count * book + (count - 1) * gap + frame)}px`
      cabinet.dataset.visibleBooks = String(count)
    }
    layout()
    const observer = new ResizeObserver(layout); observer.observe(parent)
    return () => observer.disconnect()
  }, [ref])
}
