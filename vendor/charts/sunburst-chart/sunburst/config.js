/** Visual and interaction knobs for the sunburst. Edit here first. */
export const CONFIG = {
  ringUnit: 40,
  ringGap: 1,
  /** 0 = first slice at 12 o'clock; PI = 6 o'clock */
  angleOffset: Math.PI,
  padAngle: 0.02,
  /** Angular width reserved for the selected first-ring claim */
  selectedTopAngle: Math.PI * 0.72,
  /** Weight of the selected child vs each sibling, below the first ring */
  selectedDeepMultiplier: 6,
  selectedMaxAngle: 1.85 * Math.PI,
  /** Transition duration when the selection changes, in ms */
  tweenMs: 420,
  /** Gap between the outermost ring and the viewport edge, in px */
  padding: 28,
  /** Selected-claim callout: box size and L-arrow drop from the marker */
  calloutWidth: 252,
  calloutMargin: 20,
  calloutDrop: 56,
}
