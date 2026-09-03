export type LearningThinking = 'fast' | 'deep'

const KEY = 'threadpeak-learning-thinking'
const EVENT = 'threadpeak-learning-thinking'

export function readLearningThinking(): LearningThinking {
  return sessionStorage.getItem(KEY) === 'deep' ? 'deep' : 'fast'
}

export function writeLearningThinking(value: LearningThinking) {
  if (value === 'deep') sessionStorage.setItem(KEY, 'deep')
  else sessionStorage.removeItem(KEY)
  window.dispatchEvent(new Event(EVENT))
}

export function resetLearningThinking() {
  if (sessionStorage.getItem(KEY) === null) return
  sessionStorage.removeItem(KEY)
  window.dispatchEvent(new Event(EVENT))
}

export function subscribeLearningThinking(onChange: () => void) {
  addEventListener(EVENT, onChange)
  return () => removeEventListener(EVENT, onChange)
}
