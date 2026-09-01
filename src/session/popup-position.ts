export interface AnchorRect {
  left: number
  top: number
  width: number
  height: number
}

export interface Size {
  width: number
  height: number
}

export type Side = 'right' | 'bottom' | 'left' | 'top'

export interface PositionResult {
  left: number
  top: number
  side: Side
}

function clamp(value: number, min: number, max: number) {
  if (max < min) return min
  return Math.min(Math.max(value, min), max)
}

export function computePopupPosition(
  anchor: AnchorRect,
  popup: Size,
  container: AnchorRect,
  options: { safePadding?: number; gap?: number; sides?: Side[] } = {},
): PositionResult {
  const safePadding = options.safePadding ?? 12
  const gap = options.gap ?? 4
  const sides = options.sides ?? (['top', 'bottom'] as Side[])
  const minLeft = container.left + safePadding
  const minTop = container.top + safePadding
  const maxLeft = container.left + container.width - safePadding - popup.width
  const maxTop = container.top + container.height - safePadding - popup.height
  const containable = maxLeft >= minLeft && maxTop >= minTop
  const centeredLeft = anchor.left + anchor.width / 2 - popup.width / 2
  const centeredTop = anchor.top + anchor.height / 2 - popup.height / 2
  const ideal: Record<Side, { left: number; top: number }> = {
    right: { left: anchor.left + anchor.width + gap, top: clamp(centeredTop, minTop, maxTop) },
    bottom: { left: clamp(centeredLeft, minLeft, maxLeft), top: anchor.top + anchor.height + gap },
    left: { left: anchor.left - gap - popup.width, top: clamp(centeredTop, minTop, maxTop) },
    top: { left: clamp(centeredLeft, minLeft, maxLeft), top: anchor.top - gap - popup.height },
  }

  for (const side of sides) {
    const next = ideal[side]
    if (
      containable &&
      next.left >= minLeft &&
      next.left <= maxLeft &&
      next.top >= minTop &&
      next.top <= maxTop
    ) {
      return { left: next.left, top: next.top, side }
    }
  }

  const fallback = ideal[sides[0] ?? 'top']
  return {
    left: clamp(fallback.left, minLeft, maxLeft),
    top: clamp(fallback.top, minTop, maxTop),
    side: sides[0] ?? 'top',
  }
}
