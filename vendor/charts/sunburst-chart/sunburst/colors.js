/** Outline / marker ink and the page colour they sit on. Mirrors index.css. */
export const INK = '#2c343d'
export const PAPER = '#f2f4f5'

export const FILLS = {
  thesis: ['#7dbbf4', '#4197e7', '#2985db', '#2478c6', '#1d67ac'],
  pro: ['#81e5b2', '#5fd599', '#27bc71', '#009858', '#007a47'],
  con: ['#ffa194', '#ff8675', '#f46853', '#e44b2f', '#ca3507'],
}

export function segmentFill(stance, impact = 2) {
  const scale = FILLS[stance] ?? FILLS.con
  const index = Math.max(0, Math.min(scale.length - 1, Math.round(impact)))
  return scale[index]
}

export function stanceLabel(stance) {
  if (stance === 'thesis') return 'Thesis'
  if (stance === 'pro') return 'Pro'
  return 'Con'
}
