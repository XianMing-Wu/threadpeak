export type LearningThinking = 'fast' | 'deep'

const KEY = 'threadpeak-thinking-depth'
const LEGACY_KEY = 'threadpeak-learning-thinking'
const EVENT = 'threadpeak-learning-thinking'

function readStored(): string | null {
  try {
    return localStorage.getItem(KEY) ?? sessionStorage.getItem(LEGACY_KEY)
  } catch {
    return null
  }
}

export function readLearningThinking(): LearningThinking {
  return readStored() === 'deep' ? 'deep' : 'fast'
}

export function writeLearningThinking(value: LearningThinking) {
  try {
    if (value === 'deep') localStorage.setItem(KEY, 'deep')
    else localStorage.removeItem(KEY)
    sessionStorage.removeItem(LEGACY_KEY)
  } catch {
    // private mode
  }
  window.dispatchEvent(new Event(EVENT))
}

export function resetLearningThinking() {
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
