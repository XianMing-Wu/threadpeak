export type LearningThinking = 'fast' | 'deep'

const KEY = 'threadpeak-thinking-depth'
const LEGACY_KEY = 'threadpeak-learning-thinking'
const EVENT = 'threadpeak-learning-thinking'

// A new browser session starts fast; an old persistent preference must not
// silently make all subsequent routes use deep reasoning.
let current: LearningThinking = 'fast'

export function readLearningThinking(): LearningThinking {
  return current
}

export function writeLearningThinking(value: LearningThinking) {
  current = value
  try {
    localStorage.removeItem(KEY)
    sessionStorage.removeItem(LEGACY_KEY)
  } catch {
    // private mode
  }
  window.dispatchEvent(new Event(EVENT))
}

export function resetLearningThinking() {
  current = 'fast'
  try {
    localStorage.removeItem(KEY)
    sessionStorage.removeItem(LEGACY_KEY)
  } catch {
    // private mode
  }
  window.dispatchEvent(new Event(EVENT))
}

export function subscribeLearningThinking(onChange: () => void) {
  addEventListener(EVENT, onChange)
  addEventListener('storage', onChange)
  return () => {
    removeEventListener(EVENT, onChange)
    removeEventListener('storage', onChange)
  }
}
