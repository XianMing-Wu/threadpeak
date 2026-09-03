import { emptyAnnotationStore, writeAnnotationStore } from '../session/ask-authors.ts'
import { resetLearningThinking } from '../session/learning-thinking.ts'
import { resetPathProgressStorageForTests } from '../path-3d/path-progress-storage.ts'
import { clearChatHistory, HISTORY_CHANGE_EVENT } from '../history.ts'
import { NAV_EVENT } from './nav.ts'
import { WORKSPACE_EVENT } from './store.ts'

const KEEP_ACCOUNT_KEYS = new Set(['threadpeak-authenticated', 'threadpeak-theme'])

function clearGeneratedKeys(storage: Storage) {
  const keys: string[] = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key && key.startsWith('threadpeak') && !KEEP_ACCOUNT_KEYS.has(key)) keys.push(key)
  }
  for (const key of keys) storage.removeItem(key)
}

export function resetGeneratedAccountContent() {
  clearGeneratedKeys(localStorage)
  clearGeneratedKeys(sessionStorage)
  resetPathProgressStorageForTests()
  resetLearningThinking()
  writeAnnotationStore(emptyAnnotationStore())
  clearChatHistory()
  window.dispatchEvent(new Event(WORKSPACE_EVENT))
  window.dispatchEvent(new Event(HISTORY_CHANGE_EVENT))
  window.dispatchEvent(new Event(NAV_EVENT))
}
